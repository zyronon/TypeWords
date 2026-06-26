import type { PracticeData, TaskWords, Word } from '@typewords/core/types/types.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'
import { WordPracticeMode, WordPracticeStage, WordPracticeType } from '@typewords/core/types/enum.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { cloneDeep, shuffle } from '@typewords/core/utils'
import { getFlowIdForMode } from './builtin-flows.ts'
import { GROUP_SIZE } from './phase-templates.ts'
import { buildSessionContext, loadPracticeFlow, resolvePhase } from './practice-phase-registry.ts'
import { applyPhaseDefinition, displayOverride, sessionDisplay } from './usePracticeDisplayPolicy.ts'
import type { PracticeSessionSnapshot, SessionContext } from './registry-types.ts'

export type NavigatorDeps = {
  getPracticeData: () => PracticeData
  getTaskWords: () => TaskWords
  getCurrentWord: () => Word
  checkWordIsNeedNext: (word: Word) => boolean
  complete: () => void
}

export function createPracticeWordNavigator(deps: NavigatorDeps) {
  const settingStore = useSettingStore()
  const statStore = usePracticeStore()

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

  function syncPhase() {
    const phase = resolvePhase(getCtx())
    settingStore.wordPracticeType = phase.key.practiceType
    applyPhaseDefinition(phase)
    return phase
  }

  function wordLoop(groupSize = GROUP_SIZE) {
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

  function nextStage(originList: Word[], log = '') {
    const data = deps.getPracticeData()
    const list = originList.filter(v => !deps.checkWordIsNeedNext(v))
    console.log(log)
    statStore.stage = statStore.nextStage
    if (list.length) {
      data.words = list
      data.index = 0
      syncPhase()
    } else {
      console.log(`${log}:无单词略过`)
      data.words = []
      data.index = 0
      next(false)
    }
  }

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

  function advanceStructuredStage() {
    const data = deps.getPracticeData()
    const taskWords = deps.getTaskWords()
    const mode = settingStore.wordPracticeMode

    if (mode === WordPracticeMode.System) {
      if (statStore.stage === WordPracticeStage.FollowWriteNewWord) {
        nextStage(shuffle(taskWords.new), '开始听写新词')
      } else if (statStore.stage === WordPracticeStage.ListenNewWord) {
        nextStage(shuffle(taskWords.new), '开始默写新词')
      } else if (statStore.stage === WordPracticeStage.DictationNewWord) {
        nextStage(taskWords.review, '开始自测旧词')
      } else if (statStore.stage === WordPracticeStage.IdentifyReview) {
        nextStage(shuffle(taskWords.review), '开始听写旧词')
      } else if (statStore.stage === WordPracticeStage.ListenReview) {
        nextStage(shuffle(taskWords.review), '开始默写旧词')
      } else if (statStore.stage === WordPracticeStage.DictationReview) {
        deps.complete()
      }
    } else if (mode === WordPracticeMode.ListenOnly) {
      if (statStore.stage === WordPracticeStage.ListenNewWord) {
        nextStage(taskWords.review, '开始听写旧词')
      } else if (statStore.stage === WordPracticeStage.ListenReview) {
        deps.complete()
      }
    } else if (mode === WordPracticeMode.DictationOnly) {
      if (statStore.stage === WordPracticeStage.DictationNewWord) {
        nextStage(taskWords.review, '开始默写旧词')
      } else if (statStore.stage === WordPracticeStage.DictationReview) {
        deps.complete()
      }
    } else if (mode === WordPracticeMode.IdentifyOnly) {
      if (statStore.stage === WordPracticeStage.IdentifyNewWord) {
        nextStage(taskWords.review, '开始自测旧词')
      } else if (statStore.stage === WordPracticeStage.IdentifyReview) {
        deps.complete()
      }
    } else if (mode === WordPracticeMode.Shuffle) {
      if (statStore.stage === WordPracticeStage.Shuffle) deps.complete()
    } else if (mode === WordPracticeMode.Review) {
      if (statStore.stage === WordPracticeStage.IdentifyReview) {
        nextStage(shuffle(taskWords.review), '开始听写旧词')
      } else if (statStore.stage === WordPracticeStage.ListenReview) {
        nextStage(shuffle(taskWords.review), '开始默写旧词')
      } else if (statStore.stage === WordPracticeStage.DictationReview) {
        deps.complete()
      }
    }
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

    if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
      if (data.index === data.words.length - 1) {
        data.wrongWords = data.wrongWords.filter(v => !data.excludeWords.includes(v.word))
        if (data.wrongWords.length) {
          runWrongWordRetry()
        } else {
          data.isTypingWrongWord = false
          deps.complete()
        }
      } else {
        data.index++
      }
    } else if (data.words.length === 0 || data.index === data.words.length - 1) {
      if (data.words.length) {
        if (
          (statStore.stage === WordPracticeStage.FollowWriteNewWord || data.isTypingWrongWord) &&
          !ignoreLoop &&
          settingStore.wordPracticeType !== WordPracticeType.Spell
        ) {
          data.index = Math.floor(data.index / GROUP_SIZE) * GROUP_SIZE
          emitter.emit(EventKey.resetWord)
          settingStore.wordPracticeType = WordPracticeType.Spell
          syncPhase()
          if (deps.checkWordIsNeedNext(word)) next(false, ignoreLoop)
          return
        }
      }

      data.wrongWords = data.wrongWords.filter(v => !deps.checkWordIsNeedNext(v))
      if (data.wrongWords.length) {
        runWrongWordRetry()
      } else {
        data.isTypingWrongWord = false
        advanceStructuredStage()
      }
    } else {
      if (statStore.stage === WordPracticeStage.FollowWriteNewWord) {
        wordLoop()
      } else if (data.isTypingWrongWord) {
        wordLoop()
      } else {
        data.index++
      }
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

  return { next, skipStep, syncPhase, nextStage }
}

export function buildSessionSnapshot(practiceData: PracticeData): PracticeSessionSnapshot {
  const settingStore = useSettingStore()
  return {
    wordPracticeType: settingStore.wordPracticeType,
    identifyMethod: settingStore.identifyMethod,
    isTypingWrongWord: practiceData.isTypingWrongWord,
    wordPracticeMode: settingStore.wordPracticeMode,
    flowId: getFlowIdForMode(settingStore.wordPracticeMode),
    flowVersion: 1,
    sessionDisplay:
      sessionDisplay.value?.source === 'phase' ? { ...sessionDisplay.value } : undefined,
    displayOverride: displayOverride.value ? { ...displayOverride.value } : null,
  }
}

export function restoreSessionSnapshot(snapshot: PracticeSessionSnapshot, practiceData: PracticeData, taskWords: TaskWords) {
  loadPracticeFlow(snapshot.flowId)
  const settingStore = useSettingStore()
  const statStore = usePracticeStore()

  settingStore.wordPracticeType = snapshot.wordPracticeType
  settingStore.identifyMethod = snapshot.identifyMethod
  practiceData.isTypingWrongWord = snapshot.isTypingWrongWord

  if (snapshot.sessionDisplay?.source === 'phase') {
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

export function restoreSessionFromLegacy(
  practiceData: PracticeData,
  taskWords: TaskWords
) {
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
