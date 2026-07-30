/**
 * 练习页「推进器」：对应 v1 的 next() / nextStage() / wordLoop()。
 *
 * - cursor { nodeIndex, stepIndex, inWrongWordClear, loop, endActionIndex } 是唯一位置指针
 * - resolvePhaseByCtxCursor(cursor) 是唯一相位查询入口
 * - nodeWorkingWords 是同一 Node 内 Step 之间的稳定数据流
 * - runWordLoop 读取 subSteps[]，不再硬编码 Spell 切换
 * - handleListEnd 驱动 onEnd action 队列，替代 requireWrongWordClear 布尔判断
 * - runWrongWordRetry 接收来自 wrongWordClear action 的 templateId + wordAdvance 配置
 * - Cursor 与工作词表均属于 Navigator 实例，不再是模块级共享状态
 */
import { computed, ref } from 'vue'
import type { TaskWords, Word } from '@typewords/core/types/types.ts'
import type { PracticeDataV2 } from './practice-word-session.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { cloneDeep, shuffle } from '@typewords/core/utils'
import { getFlowIdForMode, GROUP_SIZE } from './practice-flow-config.ts'
import {
  createPracticeFlowRuntime,
  getInitialCursor,
} from './practice-flow-runtime.ts'
import type {
  PracticeEndAction,
  PracticeFlowCursor,
  PracticePhaseDefinition,
  PracticeSessionSnapshot,
  PracticeWordsSource,
  PracticeWrongWordClearAction,
} from './practice-flow-types.ts'

export type NavigatorDeps = {
  getPracticeData: () => PracticeDataV2
  getTaskWords: () => TaskWords
  getCurrentWord: () => Word
  checkWordIsNeedNext: (word: Word) => boolean
  complete: () => void
}

// ─── 词源解析 ──────────────────────────────────────────────────────────────────

function resolveWordsFromSource(
  source: PracticeWordsSource,
  taskWords: TaskWords,
  data: PracticeDataV2
): Word[] {
  switch (source) {
    case 'taskNew':    return taskWords.new
    case 'taskReview': return taskWords.review
    case 'wrongWords': return data.wrongWords
    case 'current':    return data.words
  }
}

// ─── 主工厂 ──────────────────────────────────────────────────────────────────────

export function createPracticeWordNavigator(deps: NavigatorDeps) {
  const settingStore = useSettingStore()
  const statStore = usePracticeStore()
  const flowRuntime = createPracticeFlowRuntime()
  const { activeFlowConfig } = flowRuntime
  const activeCursor = ref<PracticeFlowCursor>(getInitialCursor())
  const currentPhase = computed(() => flowRuntime.resolvePhaseByCursor(activeCursor.value))
  const currentPracticeType = computed(() => currentPhase.value.practiceType)
  const currentPhaseKey = computed(() => {
    const cursor = activeCursor.value
    const config = activeFlowConfig.value
    return [
      `${config.id}@${config.version}`,
      cursor.nodeIndex,
      cursor.stepIndex,
      cursor.inWrongWordClear ? cursor.endActionIndex ?? 0 : 'main',
      cursor.loop?.subStepIndex ?? 'main',
    ].join(':')
  })
  /** 当前 Node 的稳定工作词表；错词清空只替换 data.words，不污染它。 */
  let nodeWorkingWords: Word[] = []
  function getSourceForCursor(cursor: PracticeFlowCursor): PracticeWordsSource {
    const node = activeFlowConfig.value.nodes[cursor.nodeIndex]
    return node?.source ?? 'current'
  }

  function resetCursor() {
    activeCursor.value = getInitialCursor()
  }

  function restoreCursorFromSnapshot(cursor: PracticeFlowCursor): boolean {
    const restored: PracticeFlowCursor = {
      nodeIndex: cursor.nodeIndex,
      stepIndex: cursor.stepIndex,
      inWrongWordClear: cursor.inWrongWordClear,
      loop: cursor.loop,
      endActionIndex: cursor.endActionIndex,
    }

    if (
      !Number.isInteger(restored.nodeIndex) ||
      !Number.isInteger(restored.stepIndex) ||
      typeof restored.inWrongWordClear !== 'boolean' ||
      !('loop' in cursor) ||
      !('endActionIndex' in cursor)
    ) {
      resetCursor()
      return false
    }

    const config = activeFlowConfig.value
    const node = config.nodes[restored.nodeIndex]
    if (!node?.steps[restored.stepIndex]) {
      resetCursor()
      return false
    }

    const mainPhase = flowRuntime.resolvePhaseByCursor({
      ...restored,
      inWrongWordClear: false,
      loop: null,
      endActionIndex: null,
    })
    if (
      restored.inWrongWordClear &&
      mainPhase.onEnd[restored.endActionIndex ?? 0]?.type !== 'wrongWordClear'
    ) {
      resetCursor()
      return false
    }

    const phaseWithoutLoop = flowRuntime.resolvePhaseByCursor({ ...restored, loop: null })
    if (
      restored.loop &&
      (phaseWithoutLoop.wordAdvance.type !== 'wordLoop' ||
        !Number.isInteger(restored.loop.subStepIndex) ||
        restored.loop.subStepIndex < 0 ||
        restored.loop.subStepIndex >= (phaseWithoutLoop.wordAdvance.subSteps?.length ?? 0) ||
        !Number.isInteger(restored.loop.startIndex) ||
        restored.loop.startIndex < 0 ||
        !Number.isInteger(restored.loop.endIndex) ||
        restored.loop.endIndex < restored.loop.startIndex ||
        restored.loop.endIndex >= deps.getPracticeData().words.length)
    ) {
      resetCursor()
      return false
    }

    activeCursor.value = restored
    return true
  }

  function filterWorkingWords() {
    nodeWorkingWords = nodeWorkingWords.filter(word => !deps.checkWordIsNeedNext(word))
  }

  function initializeNodeWords(words: Word[]) {
    nodeWorkingWords = [...words]
  }

  // ─── wordLoop 子步骤推进 ──────────────────────────────────────────────────────
  function enterLoop(startIndex: number, endIndex: number, subStepIndex = 0) {
    activeCursor.value = {
      ...activeCursor.value,
      loop: { startIndex, endIndex, subStepIndex },
    }
    deps.getPracticeData().index = startIndex
    emitter.emit(EventKey.resetWord)
  }

  function leaveLoop(endIndex: number) {
    activeCursor.value = { ...activeCursor.value, loop: null }
    deps.getPracticeData().index = endIndex + 1
  }

  function advanceLoopSubStep(phase: PracticePhaseDefinition) {
    const loop = activeCursor.value.loop
    if (!loop) return

    const nextSubStepIndex = loop.subStepIndex + 1
    if (nextSubStepIndex < (phase.wordAdvance.subSteps?.length ?? 0)) {
      enterLoop(loop.startIndex, loop.endIndex, nextSubStepIndex)
    } else {
      leaveLoop(loop.endIndex)
    }
  }

  /**
   * wordLoop 内推进词索引。
   * - 主步骤：index++ → 组满时进入 loop 子步骤（subStepIndex=0），重置 index 到组头
   * - loop 子步骤：这里只推进 index；到达组尾后由 handleListEnd 切换子步骤或退出 loop
   */
  function runWordLoop(phase: PracticePhaseDefinition, groupSize = GROUP_SIZE) {
    const data = deps.getPracticeData()
    const cur = activeCursor.value

    if (cur.loop !== null) {
      // 当前处于 loop 子步骤：推进 index
      data.index++
    } else {
      // 当前处于主步骤：推进 index
      data.index++
      if (data.index % groupSize === 0) {
        // 一组练完，进入 loop 子步骤
        const subSteps = phase.wordAdvance.subSteps ?? []
        if (subSteps.length > 0) {
          const groupStart = data.index - groupSize
          const groupEnd = data.index - 1
          enterLoop(groupStart, groupEnd)
        }
        // 若 subSteps 为空，则直接继续主步骤（无子步骤）
      }
    }
  }

  function runWordAdvance(phase: PracticePhaseDefinition) {
    if (phase.wordAdvance.type === 'wordLoop') {
      runWordLoop(phase, phase.wordAdvance.groupSize)
    } else {
      deps.getPracticeData().index++
    }
  }

  function goToCursor(
    newCursor: PracticeFlowCursor,
    originList: Word[],
    options: { log?: string; resetNodeWords?: boolean; shuffle?: boolean } = {}
  ) {
    const data = deps.getPracticeData()
    const list = originList.filter(v => !deps.checkWordIsNeedNext(v))
    if (options.resetNodeWords) nodeWorkingWords = [...list]
    const displayList = options.shuffle ? shuffle([...list]) : [...list]
    console.log(options.log || `[Nav] → cursor ${newCursor.nodeIndex}:${newCursor.stepIndex}`)
    activeCursor.value = newCursor
    if (displayList.length) {
      data.words = displayList
      data.index = 0
    } else {
      console.log(`[Nav] cursor ${newCursor.nodeIndex}:${newCursor.stepIndex} 无单词，跳过`)
      data.words = []
      data.index = 0
      next(false)
    }
  }

  /** 进入下一静态 Step；同 Node 继承工作词表，跨 Node 才重新解析 source。 */
  function runStepAdvance() {
    const data = deps.getPracticeData()
    const taskWords = deps.getTaskWords()
    const cur = activeCursor.value
    // onEnd/错词清空期间仍可能新增已掌握或主动跳过词，推进前再收敛一次。
    filterWorkingWords()

    const { cursor: nextCursor, complete } = flowRuntime.advanceStepCursor(cur)
    if (complete) {
      deps.complete()
      return
    }

    const config = activeFlowConfig.value
    const changedNode = nextCursor.nodeIndex !== cur.nodeIndex
    const nextSource = getSourceForCursor(nextCursor)
    const words = changedNode
      ? nextSource === 'current'
        ? nodeWorkingWords
        : resolveWordsFromSource(nextSource, taskWords, data)
      : nodeWorkingWords
    const nextStep = config.nodes[nextCursor.nodeIndex].steps[nextCursor.stepIndex]

    goToCursor(nextCursor, words, {
      resetNodeWords: changedNode,
      shuffle: nextStep.shuffleOnEnter ?? false,
    })
  }

  // ─── 错词清空（由 onEnd wrongWordClear action 驱动） ────────────────────────
  function runWrongWordRetry(action: PracticeWrongWordClearAction) {
    const data = deps.getPracticeData()
    // 实际 practiceType 由 resolvePhaseByCtxCursor 从 action.templateId 派生，无需在此设置
    console.log(`[Nav] 还有错词，进入错词清空（templateId=${action.templateId}）`)
    data.words = shuffle(cloneDeep(data.wrongWords))
    data.index = 0
    data.wrongWords = []
  }

  // ─── 即时型 action 执行 ───────────────────────────────────────────────────────
  function executeInstantAction(action: PracticeEndAction): void {
    if (action.type === 'collectWrongWords') {
      console.log(`[Nav] 收藏错词 → ${action.target}`)
      // TODO: 实际收藏逻辑（Phase 3+）
    } else if (action.type === 'generateReport') {
      console.log(`[Nav] 生成报告 → ${action.reportType}`)
      // TODO: 实际报告逻辑（Phase 3+）
    }
  }

  // ─── onEnd action 队列处理 ───────────────────────────────────────────────────

  /**
   * 执行 onEnd 队列中的下一个 action。
   * - wrongWordClear：有错词则进入 runWrongWordRetry；无错词则继续推进队列
   * - 即时型：执行后立即推进到下一个 action
   * - 队列耗尽：进入下一静态 Step
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
          runWrongWordRetry(action)
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
        // nextStep 或其他 → 进入下一静态 Step
        break
      }

      // collectWrongWords / generateReport：即时型
      executeInstantAction(action)
      actionIdx++
    }

    // 队列耗尽或遇到 navigate(nextStep)，进入下一静态 Step
    runStepAdvance()
  }

  function handleListEnd(phase: PracticePhaseDefinition, ignoreLoop = false): void {
    const data = deps.getPracticeData()
    let cur = activeCursor.value

    // loop 子步骤到达组尾时，直接在结束处理中切换子步骤。
    // 若刚完成的是整张词表的最后一组，则继续向下执行 Step 收尾。
    if (!ignoreLoop && cur.loop !== null) {
      const loopEndIndex = cur.loop.endIndex
      advanceLoopSubStep(phase)
      if (activeCursor.value.loop !== null || loopEndIndex < data.words.length - 1) return
      cur = activeCursor.value
    } else if (ignoreLoop && cur.loop !== null) {
      activeCursor.value = { ...cur, loop: null }
      cur = activeCursor.value
    }

    // ── 情形 1：处于 inWrongWordClear（错词清空完毕，判断是否还有错词） ──
    if (cur.inWrongWordClear) {
      data.wrongWords = data.wrongWords.filter(v => !deps.checkWordIsNeedNext(v))
      const mainPhase = flowRuntime.getMainPhase(cur)
      if (data.wrongWords.length > 0) {
        // 继续错词清空
        const endActionIdx = cur.endActionIndex ?? 0
        const action = mainPhase.onEnd[endActionIdx]
        if (action?.type === 'wrongWordClear') {
          // 重置 loop 状态（上一轮可能残留 loop 脏数据），避免 runWordLoop 误判
          activeCursor.value = { ...cur, loop: null }
          runWrongWordRetry(action)
          return
        }
      }

      // 错词清空完毕，继续下一个 action
      const nextActionIdx = (cur.endActionIndex ?? 0) + 1
      activeCursor.value = { ...cur, inWrongWordClear: false, endActionIndex: null }
      processNextEndAction(mainPhase, nextActionIdx)
      return
    }

    // ── 情形 2.5：wordLoop 主步骤词表自然结束，最后一组尚未进入 loop 子步骤 ──
    // 例如 20 个词、groupSize=7，前三组 0-6/7-13 正常进入 loop，但最后一组 14-19 因
    // index 停在 19 不满足 19%7===0，导致漏入。这里补刀：词表穷尽时若主步骤是 wordLoop，
    // 将当前未完成的组强行送入 loop 子步骤。
    // 注意：此判断仅在 index 仍处于列表有效范围内生效；若 index 已越界（loop 退出后
    // endIndex+1 == words.length），应走情形 3 的 onEnd / 静态 Step 推进。
    if (!ignoreLoop && phase.wordAdvance.type === 'wordLoop' && data.words.length > 0 && data.index < data.words.length) {
      const groupSize = phase.wordAdvance.groupSize ?? GROUP_SIZE
      const endIndex = data.index
      const groupStart = Math.floor(endIndex / groupSize) * groupSize
      const subSteps = phase.wordAdvance.subSteps

      if (subSteps && subSteps.length > 0) {
        enterLoop(groupStart, endIndex)
        return
      }
    }

    // ── 情形 3：普通主步骤词表练完 → 更新 Node 输出并进入 onEnd 队列 ──
    // 普通 Step 只移除已掌握/主动跳过词；Identify 中认识的词也已进入排除列表，
    // 因而自测 Step 的输出自然只剩 unknown/答错词。错词清空期间不会改写这份输出。
    filterWorkingWords()
    if (phase.onEnd.length > 0) {
      processNextEndAction(phase, 0)
      return
    }

    // 无 onEnd，直接进入下一静态 Step
    runStepAdvance()
  }

  function atListEnd(data: PracticeDataV2): boolean {
    // loop 子步骤中，词表范围是 [loop.startIndex, loop.endIndex]
    const cur = activeCursor.value
    if (cur.loop !== null) {
      return data.index >= cur.loop.endIndex
    }
    return data.words.length === 0 || data.index >= data.words.length - 1
  }

  function next(isTyping = true, ignoreLoop = false) {
    const data = deps.getPracticeData()
    const word = deps.getCurrentWord()
    const temp = word.word.toLowerCase()
    const preTimes = data.wrongTimesMap[temp] ?? 0
    const phase = currentPhase.value

    const loop = activeCursor.value.loop
    const loopSubStep = loop
      ? phase.wordAdvance.subSteps?.[loop.subStepIndex]
      : undefined
    if (loopSubStep?.clearWrongOnSuccess && data.wrongTimes === 0) {
      const rIndex = data.wrongWords.findIndex(v => v.word.toLowerCase() === temp)
      if (rIndex >= 0) data.wrongWords.splice(rIndex, 1)
    }

    data.wrongTimesMap[temp] = preTimes + data.wrongTimes
    data.wrongTimes = 0
    if (isTyping) statStore.inputWordNumber++

    if (atListEnd(data)) {
      handleListEnd(phase, ignoreLoop)
    } else {
      runWordAdvance(phase)
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

  /** 外部批量交互已消费完当前词表，按当前 Phase 的 onEnd 队列正常收尾。 */
  function completeCurrentList() {
    handleListEnd(currentPhase.value, true)
  }

  function buildSessionSnapshot(): PracticeSessionSnapshot {
    return {
      identifyMethod: settingStore.identifyMethod,
      flowId: flowRuntime.getActiveFlowId(),
      cursor: {
        ...activeCursor.value,
        loop: activeCursor.value.loop ? { ...activeCursor.value.loop } : null,
      },
      nodeWorkingWordKeys: nodeWorkingWords.map(word => word.word),
    }
  }

  function restoreWorkingWords(keys?: string[]) {
    const data = deps.getPracticeData()
    const taskWords = deps.getTaskWords()
    if (keys) {
      const wordMap = new Map(
        [...taskWords.new, ...taskWords.review, ...data.words, ...data.wrongWords]
          .map(word => [word.word.toLowerCase(), word])
      )
      nodeWorkingWords = keys
        .map(key => wordMap.get(key.toLowerCase()))
        .filter((word): word is Word => !!word)
      return
    }

    nodeWorkingWords = resolveWordsFromSource(getSourceForCursor(activeCursor.value), taskWords, data)
      .filter(word => !deps.checkWordIsNeedNext(word))
  }

  function restoreSessionSnapshot(snapshot: PracticeSessionSnapshot): boolean {
    flowRuntime.loadPracticeFlow(snapshot.flowId)

    const flowMatched = activeFlowConfig.value.id === snapshot.flowId
    const cursorRestored = flowMatched && restoreCursorFromSnapshot(snapshot.cursor)
    if (!cursorRestored) {
      flowRuntime.loadPracticeFlow(getFlowIdForMode(WordPracticeMode.System))
      resetCursor()
    }

    settingStore.wordPracticeMode = activeFlowConfig.value.mode
    settingStore.identifyMethod = snapshot.identifyMethod

    restoreWorkingWords(cursorRestored ? snapshot.nodeWorkingWordKeys : undefined)
    return cursorRestored
  }

  return {
    activeFlowConfig,
    activeCursor,
    currentPhase,
    currentPracticeType,
    currentPhaseKey,
    next,
    skipStep,
    completeCurrentList,
    initializeNodeWords,
    buildSessionSnapshot,
    restoreSessionSnapshot,
    resolveFlowStart: flowRuntime.resolveFlowStart,
  }
}
