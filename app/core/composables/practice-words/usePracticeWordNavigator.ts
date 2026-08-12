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
import { computed, nextTick, ref } from 'vue'
import type { TaskWords, Word } from '@/core/types/types.ts'
import type { PracticeData } from './practice-word-session.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { usePracticeStore } from '@/core/stores/practice.ts'
import { WordPracticeMode } from '@/core/types/enum.ts'
import { emitter, EventKey } from '@/core/utils/eventBus.ts'
import { cloneDeep, shuffle } from '@/core/utils'
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
  PracticeNotifier,
  PracticeWordsSource,
  PracticeWrongWordClearAction,
} from './practice-flow-types.ts'

export type NavigatorDeps = {
  getPracticeData: () => PracticeData
  getTaskWords: () => TaskWords
  getCurrentWord: () => Word
  checkWordIsNeedNext: (word: Word) => boolean
  complete: () => void
  notify?: PracticeNotifier
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
    const previousWord = deps.getCurrentWord()
    activeCursor.value = {
      ...activeCursor.value,
      loop: { startIndex, endIndex, subStepIndex },
    }
    deps.getPracticeData().index = startIndex

    // 切回组头后若还是同一个 Word 引用（典型场景为 groupSize=1），props.word
    // 不会触发子组件的 watch，需要显式重置。事件必须等 Vue 刷新 practiceType
    // 等 props 后再发，否则会拿旧 props 播放刚完成的上一个单词。
    // 组头是另一个 Word 时，props.word 的 watch 自己会完成重置和播放，避免重复触发。
    const targetWord = deps.getCurrentWord()
    const scheduledLoop = activeCursor.value.loop
    if (targetWord === previousWord) {
      nextTick(() => {
        if (activeCursor.value.loop === scheduledLoop && deps.getCurrentWord() === targetWord) {
          emitter.emit(EventKey.resetWord)
        }
      })
    }
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
    data.words = displayList
    data.index = 0
  }

  /** 进入下一静态 Step；同 Node 继承工作词表，跨 Node 才重新解析 source。 */
  function runStepAdvance(): boolean {
    const data = deps.getPracticeData()
    const taskWords = deps.getTaskWords()
    // onEnd/错词清空期间仍可能新增已掌握或主动跳过词，推进前再收敛一次。
    filterWorkingWords()

    // 空 Node/Step 在游标层迭代跳过，不能调用 next() 伪造“完成了一个空单词”。
    while (true) {
      const cur = activeCursor.value
      const { cursor: nextCursor, complete } = flowRuntime.advanceStepCursor(cur)
      if (complete) {
        deps.complete()
        return true
      }

      const config = activeFlowConfig.value
      const changedNode = nextCursor.nodeIndex !== cur.nodeIndex
      const nextSource = getSourceForCursor(nextCursor)
      const words = changedNode
        ? nextSource === 'current'
          ? nodeWorkingWords
          : resolveWordsFromSource(nextSource, taskWords, data)
        : nodeWorkingWords
      const list = words.filter(word => !deps.checkWordIsNeedNext(word))
      const nextStep = config.nodes[nextCursor.nodeIndex].steps[nextCursor.stepIndex]

      if (list.length === 0) {
        console.log(`[Nav] cursor ${nextCursor.nodeIndex}:${nextCursor.stepIndex} 无单词，跳过`)
        activeCursor.value = nextCursor
        data.words = []
        data.index = 0
        if (changedNode) nodeWorkingWords = []
        continue
      }

      goToCursor(nextCursor, list, {
        resetNodeWords: changedNode,
        shuffle: nextStep.shuffleOnEnter ?? false,
      })
      return false
    }
  }

  // ─── 错词清空（由 onEnd wrongWordClear action 驱动） ────────────────────────
  function runWrongWordRetry(action: PracticeWrongWordClearAction) {
    const data = deps.getPracticeData()
    // 实际 practiceType 由 resolvePhaseByCtxCursor 从 action.templateId 派生，无需在此设置
    deps.notify?.('info', '还有错词，继续巩固一下吧')
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
  function processNextEndAction(phase: PracticePhaseDefinition, startActionIndex: number): boolean {
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
          return false // 挂起，等待用户完成错词清空
        }
        // 无错词，跳过此 action，继续下一个
        actionIdx++
        continue
      }

      if (action.type === 'navigate') {
        if (action.target === 'complete') {
          deps.complete()
          return true
        }
        // nextStep → 进入下一静态 Step
        break
      }

      // collectWrongWords / generateReport：即时型
      executeInstantAction(action)
      actionIdx++
    }

    // 队列耗尽或遇到 navigate(nextStep)，进入下一静态 Step
    return runStepAdvance()
  }

  function handleListEnd(phase: PracticePhaseDefinition, ignoreLoop = false): boolean {
    const data = deps.getPracticeData()
    let cur = activeCursor.value
    let ownerPhase = phase

    // loop 子步骤到达组尾时，直接在结束处理中切换子步骤。
    // 若刚完成的是整张词表的最后一组，则继续向下执行 Step 收尾。
    if (!ignoreLoop && cur.loop !== null) {
      const loopEndIndex = cur.loop.endIndex
      advanceLoopSubStep(phase)
      if (activeCursor.value.loop !== null || loopEndIndex < data.words.length - 1) return false
      cur = activeCursor.value
      // 当前交互 phase 是最后一个 loop subStep；退出 loop 后必须回到所属 Step/Action 收尾。
      ownerPhase = flowRuntime.resolvePhaseByCursor(cur)
    } else if (ignoreLoop && cur.loop !== null) {
      activeCursor.value = { ...cur, loop: null }
      cur = activeCursor.value
      ownerPhase = flowRuntime.resolvePhaseByCursor(cur)
    }

    // ── 情形 1：wordLoop 主阶段词表自然结束，最后一组尚未进入 loop 子步骤 ──
    // 该判断必须早于 wrongWordClear 完成判断，否则错词清空 action 自己的尾组 loop 会被绕过。
    if (!ignoreLoop && ownerPhase.wordAdvance.type === 'wordLoop' && data.words.length > 0 && data.index < data.words.length) {
      const groupSize = ownerPhase.wordAdvance.groupSize ?? GROUP_SIZE
      const endIndex = data.index
      const groupStart = Math.floor(endIndex / groupSize) * groupSize
      const subSteps = ownerPhase.wordAdvance.subSteps

      if (subSteps && subSteps.length > 0) {
        enterLoop(groupStart, endIndex)
        return false
      }
    }

    // ── 情形 2：处于 inWrongWordClear（自身 loop 已完成，判断是否还有错词） ──
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
          return false
        }
      }

      // 错词清空完毕，继续下一个 action
      const nextActionIdx = (cur.endActionIndex ?? 0) + 1
      activeCursor.value = { ...cur, inWrongWordClear: false, endActionIndex: null }
      return processNextEndAction(mainPhase, nextActionIdx)
    }

    // ── 情形 3：普通主步骤词表练完 → 更新 Node 输出并进入 onEnd 队列 ──
    // 普通 Step 只移除已掌握/主动跳过词；Identify 中认识的词也已进入排除列表，
    // 因而自测 Step 的输出自然只剩 unknown/答错词。错词清空期间不会改写这份输出。
    filterWorkingWords()
    if (ownerPhase.onEnd.length > 0) {
      return processNextEndAction(ownerPhase, 0)
    }

    // 无 onEnd，直接进入下一静态 Step
    return runStepAdvance()
  }

  function atListEnd(data: PracticeData): boolean {
    // loop 子步骤中，词表范围是 [loop.startIndex, loop.endIndex]
    const cur = activeCursor.value
    if (cur.loop !== null) {
      return data.index >= cur.loop.endIndex
    }
    return data.words.length === 0 || data.index >= data.words.length - 1
  }

  function next(isTyping = true, ignoreLoop = false) {
    let countAsTyping = isTyping
    let shouldIgnoreLoop = ignoreLoop

    // 已掌握/主动跳过的连续单词在同一推进循环内消费，避免递归造成深栈和重复进入。
    while (true) {
      const data = deps.getPracticeData()
      const word = deps.getCurrentWord()
      if (!word.word) {
        runStepAdvance()
        return
      }

      const temp = word.word
      const preTimes = data.wrongTimesMap[temp] ?? 0
      const phase = currentPhase.value
      data.wrongTimesMap[temp] = preTimes + data.wrongTimes
      data.wrongTimes = 0
      if (countAsTyping) statStore.inputWordNumber++

      const completed = atListEnd(data)
        ? handleListEnd(phase, shouldIgnoreLoop)
        : (runWordAdvance(phase), false)
      if (completed || data.words.length === 0 || !deps.checkWordIsNeedNext(deps.getCurrentWord())) return

      countAsTyping = false
      shouldIgnoreLoop = false
    }
  }

  function prev() {
    const data = deps.getPracticeData()
    if (data.index === 0) {
      deps.notify?.('warning', '已经是第一个了~')
    } else {
      data.index--
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
          .map(word => [word.word, word])
      )
      nodeWorkingWords = keys
        .map(key => wordMap.get(key))
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
    prev,
    skipStep,
    completeCurrentList,
    initializeNodeWords,
    buildSessionSnapshot,
    restoreSessionSnapshot,
    resolveFlowStart: flowRuntime.resolveFlowStart,
  }
}
