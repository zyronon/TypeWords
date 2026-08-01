<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref, watch } from 'vue'
import StatisticsV2 from '~/components/practice-words-v2/StatisticsV2.vue'
import { emitter, EventKey, useEvents } from '@typewords/core/utils/eventBus.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import type { Dict, TaskWords, Word } from '@typewords/core/types/types.ts'
import { useStartKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import { usePracticeDisplayPolicy } from '~/composables/practice-words/usePracticeDisplayPolicy.ts'
import { createPracticeWordNavigator } from '~/composables/practice-words/usePracticeWordNavigator.ts'
import useTheme from '@typewords/core/hooks/theme.ts'
import { getCurrentStudyWord, useWordOptions } from '@typewords/core/hooks/dict.ts'
import { openWordCollectPicker } from '@typewords/core/hooks/useWordCollectPicker.ts'
import {
  _getDictDataByUrl,
  cloneDeep,
  debounce,
  getShufflePracticeWords,
  resourceWrap,
  shuffle,
  throttle,
} from '@typewords/core/utils'
import { useRoute, useRouter } from 'vue-router'
import FooterV2 from '~/components/practice-words-v2/FooterV2.vue'
import Panel from '@typewords/core/components/Panel.vue'
import { BaseIcon, Dialog, Toast, ToastComponent, Tooltip } from '@typewords/base'
import WordList from '@typewords/core/components/list/WordList.vue'
import TypeWordV2 from '~/components/practice-words-v2/TypeWordV2.vue'
import Empty from '@typewords/core/components/Empty.vue'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'
import { getDefaultDict, getDefaultWord } from '@typewords/core/types/func.ts'
import PracticeLayout from '@typewords/core/components/PracticeLayout.vue'
import PracticeOnboardingHostV2 from '~/components/practice-words-v2/PracticeOnboardingHostV2.vue'
import { AppEnv, DICT_LIST } from '@typewords/core/config/env.ts'
import { addStat, setUserDictProp } from '@typewords/core/apis'
import GroupList from '@typewords/core/components/word/GroupList.vue'
import {
  getDefaultPracticeData,
  type PracticeDataV2,
  type PracticeWordCacheV2,
  UnsupportedPracticeCacheVersionError,
  usePracticeWordPersistenceV2,
} from '~/composables/practice-words/practice-word-session.ts'
import { flushStatToStore } from '@typewords/core/composables/usePracticePersistence.ts'
import { useDataSyncPersistence } from '@typewords/core/composables/useDataSyncPersistence.ts'
import { IdentifyMethod, ShortcutKey, WordPracticeMode, WordPracticeType } from '@typewords/core/types/enum.ts'
import { createEmptyCard, Rating } from 'ts-fsrs'
import { useGetGradeByWrongTimes, useNextCard } from '@typewords/core/hooks/fsrs.ts'
import WordMarkPickList, { type WordMarkPickResult } from '@typewords/core/components/word/WordMarkPickList.vue'
import { buildQuestion } from '@typewords/core/utils/word-test.ts'
import type { PracticeSessionSnapshot } from '~/composables/practice-words/practice-flow-types.ts'
import {
  canAutoResumeVisibilityTimer,
  usePracticeIdleTimer,
} from '~/composables/practice-words/usePracticeIdleTimer.ts'

const { isWordSimple, toggleWordSimple } = useWordOptions()
const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const { toggleTheme } = useTheme()
const router = useRouter()
const route = useRoute()
const store = useBaseStore()
const statStore = usePracticeStore()
const dataSync = useDataSyncPersistence()
const wordPersistence = usePracticeWordPersistenceV2()
let { getGradeByWrongTimes } = useGetGradeByWrongTimes()
let { nextCard } = useNextCard()
const typingRef: any = $ref()
const onboardingHostRef = ref<InstanceType<typeof PracticeOnboardingHostV2>>()
let isComplete = $ref(false)
let loading = $ref(false)
let settling = $ref(false)
let showRemoteReloadDialog = $ref(false)
let remoteCheckInProgress = false
let pendingRemoteUpdatedAt = 0
let knownCacheUpdatedAt = Date.now()
let visibilityResumeTimer: ReturnType<typeof setTimeout> | null = null
/** 仅用于 visibilitychange 内 fetch：与 `!document.hidden` 一致 */
const isFocus = ref(true)
let taskWords = $ref<TaskWords>({
  new: [],
  review: [],
})

//watch 实例列表，用于本地代码修改hrm后，导致重复watch
let watchRefList = []
let data = $ref<PracticeDataV2>(getDefaultPracticeData({}))

const navigator = createPracticeWordNavigator({
  getPracticeData: () => data,
  getTaskWords: () => taskWords,
  getCurrentWord: () => data.words[data.index] ?? getDefaultWord(),
  checkWordIsNeedNext: (word: Word) => {
    if (!word.word) return false
    const rIndex = data.excludeWords.findIndex(v => v === word.word)
    return isWordSimple(word) || rIndex > -1
  },
  complete,
})
const { activeFlowConfig, activeCursor, currentPhase, currentPracticeType, currentPhaseKey } = navigator
const { effective, toggleDictation, toggleTranslate, setWordMasked } = usePracticeDisplayPolicy(
  currentPracticeType,
  currentPhaseKey
)

function next(isTyping: boolean = true, ignoreLoop = false) {
  navigator.next(isTyping, ignoreLoop)
}

function skipStep() {
  navigator.skipStep()
}

function restorePracticeSession(cache: { sessionSnapshot?: PracticeSessionSnapshot }): boolean {
  if (!cache.sessionSnapshot) return false
  return navigator.restoreSessionSnapshot(cache.sessionSnapshot)
}

/** 将完整缓存恢复到当前响应式会话对象。 */
function applyPracticeCache(cache: PracticeWordCacheV2): boolean {
  if (!cache.practiceData || !cache.statStoreData) return false

  // 远端运行中恢复也会走这里；快照无效时必须保留当前内存会话，不能只恢复一半。
  const previousTaskWords = cloneDeep(taskWords)
  const previousData = cloneDeep(data)
  const previousStatStoreData = cloneDeep(statStore.$state)
  const previousSessionSnapshot = navigator.buildSessionSnapshot()

  Object.assign(taskWords, cache.taskWords)
  data = getDefaultPracticeData(data, cache.practiceData)
  statStore.$patch(cache.statStoreData)
  if (!restorePracticeSession(cache)) {
    Object.assign(taskWords, previousTaskWords)
    data = getDefaultPracticeData(data, previousData)
    statStore.$patch(previousStatStoreData)
    navigator.restoreSessionSnapshot(previousSessionSnapshot)
    return false
  }
  if (!statStore.timerPaused) {
    const now = Date.now()
    statStore.segments.push([now, now])
  }
  return true
}

watch([() => data.words, () => data.index, currentPracticeType, () => settingStore.identifyMethod], () => {
  updateQuestion()
  handleResumeTimer()
})

function updateQuestion() {
  const word = data.words?.[data.index]
  const shouldBuildQuestion =
    currentPracticeType.value === WordPracticeType.Identify && settingStore.identifyMethod === IdentifyMethod.WordTest

  data.question = shouldBuildQuestion && word ? buildQuestion(word, allWords) : null
}

provide('practiceData', data)
provide('practiceTaskWords', taskWords)
provide('practiceFlowCursor', activeCursor)
provide('practiceFlowConfig', activeFlowConfig)

const { bumpActivity, handleResumeTimer, startTimer, stopTimer } = usePracticeIdleTimer({
  isFocus,
  statStore,
})

provide('bumpPracticeTimerActivity', bumpActivity)

watch(
  [() => store.load, () => loading],
  ([a, b]) => {
    if (a && b) loadDict()
  },
  { immediate: true }
)

const onvisibilitychange = async () => {
  isFocus.value = !document.hidden
  if (isFocus.value) {
    bumpActivity()
    if (await checkRemotePracticeUpdate()) return
    scheduleVisibilityResume()
  } else {
    clearVisibilityResumeTimer()
    statStore.pauseTimer('auto_visibility')
    if (!showRemoteReloadDialog) await savePracticeDataIns()
  }
}

function clearVisibilityResumeTimer() {
  if (visibilityResumeTimer) clearTimeout(visibilityResumeTimer)
  visibilityResumeTimer = null
}

function scheduleVisibilityResume() {
  clearVisibilityResumeTimer()
  if (document.hidden || showRemoteReloadDialog) return
  if (canAutoResumeVisibilityTimer(statStore)) {
    // 特意延迟提示用户，让用户看到，免得用户焦虑，以为没暂停。
    visibilityResumeTimer = setTimeout(() => {
      visibilityResumeTimer = null
      if (document.hidden || showRemoteReloadDialog) return
      if (!canAutoResumeVisibilityTimer(statStore)) return
      statStore.resumeTimer()
      Toast.success('已自动恢复计时')
    }, 1500)
  }
}

async function checkRemotePracticeUpdate(): Promise<boolean> {
  if (remoteCheckInProgress || showRemoteReloadDialog) return showRemoteReloadDialog
  remoteCheckInProgress = true
  try {
    const remoteUpdatedAt = await wordPersistence.getRemoteUpdateTime(knownCacheUpdatedAt)
    if (document.hidden || !remoteUpdatedAt) return false
    pendingRemoteUpdatedAt = remoteUpdatedAt
    showRemoteReloadDialog = true
    return true
  } catch (error) {
    if (error instanceof UnsupportedPracticeCacheVersionError) {
      Toast.error('远端练习缓存来自更高版本，请升级后再继续')
    } else {
      console.error('[practice-v2] 检查远端练习进度失败', error)
    }
    return false
  } finally {
    remoteCheckInProgress = false
  }
}

function keepCurrentPracticeSession() {
  knownCacheUpdatedAt = Math.max(knownCacheUpdatedAt, pendingRemoteUpdatedAt)
  pendingRemoteUpdatedAt = 0
}

function onRemoteReloadDialogClosed() {
  showRemoteReloadDialog = false
  scheduleVisibilityResume()
}

async function reloadRemotePracticeSession(): Promise<boolean> {
  if (runtimeStore.globalLoading) return false
  runtimeStore.globalLoading = true
  try {
    const cache = await wordPersistence.load()
    knownCacheUpdatedAt = Math.max(knownCacheUpdatedAt, pendingRemoteUpdatedAt, Date.now())
    pendingRemoteUpdatedAt = 0
    if (!cache) {
      Toast.warning('远端练习已结束或缓存已清空')
      await router.push('/words-v2')
      return true
    }
    if (!applyPracticeCache(cache)) {
      Toast.error('远端练习进度无效，无法重新加载')
      return false
    }
    emitter.emit(EventKey.resetWord)
    Toast.success('已加载其他设备的最新进度')
    return true
  } catch (error) {
    if (error instanceof UnsupportedPracticeCacheVersionError) {
      Toast.error('远端练习缓存来自更高版本，请升级后再继续')
    } else {
      console.error('[practice-v2] 加载远端练习进度失败', error)
      Toast.error('远端进度加载失败，请稍后重试')
    }
    return false
  } finally {
    runtimeStore.globalLoading = false
  }
}

onMounted(async () => {
  //如果是从单词学习主页过来的，就直接使用；否则等待加载
  if (runtimeStore.routeData) {
    await initData(null, true)
  } else {
    loading = true
  }
  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)
})

onUnmounted(async () => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  clearVisibilityResumeTimer()
  if (!showRemoteReloadDialog) await savePracticeDataIns()
  stopTimer()
  watchRefList.map(v => v?.stop())
})

let allWords: Word[] = []
let isIniting = ref(true)

async function loadDict() {
  let dict = getDefaultDict()
  let dictId = route.params.id
  if (dictId) {
    //先在自己的词典列表里面找，如果没有再在资源列表里面找
    dict = store.word.bookList.find(v => v.id === dictId)
    let r = await fetch(resourceWrap(DICT_LIST.WORD.ALL))
    let dict_list = await r.json()
    if (!dict) dict = dict_list.flat().find(v => v.id === dictId) as Dict
    if (dict && dict.id) {
      //如果是不是自定义词典，就请求数据
      if (!dict.custom) dict = await _getDictDataByUrl(dict)
      if (!dict.words.length) {
        router.push('/words')
        return Toast.warning('没有单词可学习！')
      }
      store.changeDict(dict)
      await initData(null, true)
      loading = false
    } else {
      router.push('/words')
    }
  } else {
    router.push('/words')
  }
}

async function initData(initVal?: TaskWords, init: boolean = false) {
  isIniting.value = true
  //只有初始化时，才读取缓存（本地 + 可选 Supabase）
  if (init) {
    let d = runtimeStore.routeData
    if (!d) {
      try {
        d = await wordPersistence.load()
      } catch (error) {
        if (!(error instanceof UnsupportedPracticeCacheVersionError)) throw error
        Toast.error('练习缓存来自更高版本，请升级后再继续')
        await router.push('/words-v2')
        return
      }
    }
    if (!d) {
      initData(getCurrentStudyWord())
      return
    }
    if (!applyPracticeCache(d)) {
      initData(d.taskWords)
      return
    }
    console.log('initData')
  } else {
    console.log('initData')
    //不能直接赋值，会导致 inject 的数据为默认值
    taskWords = Object.assign(taskWords, initVal)
    try {
      const start = navigator.resolveFlowStart(settingStore.wordPracticeMode, taskWords)
      data = getDefaultPracticeData(data, { words: start.words })
      statStore.total = start.total
      statStore.newWordNumber = start.newWordNumber
      statStore.reviewWordNumber = start.reviewWordNumber
      // resolveFlowStart 会跳过没有可练单词的 node，必须使用它返回的真实起点。
      activeCursor.value = { ...start.cursor }
      navigator.initializeNodeWords(start.words)
    } catch {
      Toast.warning('没有可学习的单词！')
      router.push('/words')
      return
    }
    statStore.startDate = Date.now()
    statStore.inputWordNumber = 0
    statStore.wrong = 0
    statStore.spend = 0
    statStore.segments = []
    statStore.resumeTimer() // 同时 push 第一条片段 [now, now]
  }

  // 初始化 Question
  let dictId: any = route.params.id
  let d = store.word.bookList.find(v => v.id === dictId)
  if (!d) d = store.sdict
  if (!d?.id) return router.push('/words')
  allWords = shuffle(d.words)
  updateQuestion()

  startTimer()
  knownCacheUpdatedAt = Math.max(knownCacheUpdatedAt, Date.now())
  isIniting.value = false
  settling = isComplete = false
}

const word = $computed<Word>(() => {
  return data.words[data.index] ?? getDefaultWord()
})
const prevWord: Word | null = $computed(() => {
  return data.words?.[data.index - 1] ?? null
})
const nextWord: Word | null = $computed(() => {
  return data.words?.[data.index + 1] ?? null
})

// 显隐与阶段同步由 Registry applyPhase 负责（Phase 2）
async function complete() {
  if (!isComplete) {
    let start = Date.now()
    console.log('全完学完了')
    isComplete = true
    settling = true
    runtimeStore.globalLoading = true
    stopTimer()
    try {
      //如果 shuffle 数组不为空，就说明是复习，不用修改 lastLearnIndex
      if (settingStore.wordPracticeMode !== WordPracticeMode.Shuffle) {
        store.sdict.lastLearnIndex = store.sdict.lastLearnIndex + statStore.newWordNumber
        // 检查已忽略的单词数量，是否全部完成
        let ignoreList = [store.allIgnoreWords, store.knownWords][settingStore.ignoreSimpleWord ? 0 : 1]
        // 忽略单词数
        const ignoreCount = ignoreList.filter(word =>
          store.sdict.words.slice(store.sdict.lastLearnIndex).some(w => w.word.toLowerCase() === word)
        ).length
        // 如果lastLearnIndex已经超过可学单词数，则判定完成
        if (store.sdict.lastLearnIndex + ignoreCount >= store.sdict.length) {
          store.sdict.complete = true
          store.sdict.lastLearnIndex = store.sdict.length
        }
      }

      // 结算前先将最后一条片段的 end 定格为当前时刻（segments 已是最新，无需临时快照）
      if (!statStore.timerPaused && statStore.segments.length > 0) {
        statStore.segments[statStore.segments.length - 1][1] = Date.now()
      }

      // 按自然日对 segments 分组，每天生成一条 Statistics 记录，落库到 store.sdict.statistics
      flushStatToStore(statStore.$state)

      for (const [word, wrongTimes] of Object.entries(data.wrongTimesMap)) {
        let rating = data.ratingMap[word]
        if (rating !== undefined) {
          setWordCard(rating, word)
        } else {
          // 则根据错误次数生成评级
          setWordCard(getGradeByWrongTimes(wrongTimes), word, wrongTimes)
        }
      }

      try {
        if (AppEnv.CAN_REQUEST) {
          let res = await addStat({
            ...data,
            type: 'word',
            perDayStudyNumber: store.sdict.perDayStudyNumber,
            lastLearnIndex: store.sdict.lastLearnIndex,
            complete: store.sdict.complete,
          })
          if (!res.success) Toast.error(res.msg)
        }
        await dataSync.saveDictState(store.$state, { pullWhenRemoteNewer: false })
      } catch (error) {
        console.error('[practice-v2] 远端结算同步失败', error)
        Toast.error('本地结算已完成，远端同步失败，可稍后重试')
      }

      await wordPersistence.clear()

      let trackData = {
        funSpend: Date.now() - start,
        name: store.sdict.name,
        spend: Number(statStore.spend / 1000 / 60).toFixed(1),
        index: store.sdict.lastLearnIndex,
        per: store.sdict.perDayStudyNumber,
        custom: store.sdict.custom,
        complete: store.sdict.complete,
        str: '',
      }
      trackData.str = `name:${trackData.name},per:${trackData.per},spend:${trackData.spend},index:${trackData.index},funSpend:${trackData.funSpend}`
      window.umami?.track('endStudyWord', trackData)
    } catch (error) {
      console.error('[practice-v2] 本地结算失败', error)
      Toast.error('结算失败，请重试')
    } finally {
      settling = false
      runtimeStore.globalLoading = false
    }
  }
}

function addExcludeWord() {
  //标记模式时，用户认识的单词加入到排除里面，后续不再复习
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex < 0) {
    data.excludeWords.push(word.word)
  }
}

function onWordKnow() {
  //"我认识“强制更新了Good，因为点”已掌握“才会设置Easy
  data.ratingMap[word.word.toLowerCase()] = Rating.Good
  addExcludeWord()
}

function onTypeWrong() {
  data.wrongTimes++
  //这里的代码暂时不能移动，因为要实时把错词加入到列表里面，从而更新toolbar里面的错词数
  //todo 后续可以优化
  let temp = word.word.toLowerCase()
  if (!data.allWrongWords.find(v => v === temp)) {
    data.allWrongWords.push(temp)
    statStore.wrong++
  }
  if (!store.wrong.words.find((v: Word) => v.word.toLowerCase() === temp)) {
    store.wrong.words.push(word)
    store.wrong.length = store.wrong.words.length
  }
  if (!data.wrongWords.find((v: Word) => v.word.toLowerCase() === temp)) {
    data.wrongWords.push(word)
  }
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex > -1) {
    data.excludeWords.splice(rIndex, 1)
  }
  savePracticeData()
}

//设置单词卡片
function setWordCard(rating: number, wordStr = word.word, times?: number) {
  let card = store.fsrsData[wordStr]
  if (!card) {
    card = createEmptyCard()
  }
  card = nextCard(card, rating)
  store.fsrsData[wordStr] = card
}

async function savePracticeDataIns() {
  // cursor 在初始位置且 index=0 且还是跟写 → 尚未开始练习
  if (
    data.index === 0 &&
    activeCursor.value.nodeIndex === 0 &&
    activeCursor.value.stepIndex === 0 &&
    !activeCursor.value.inWrongWordClear &&
    activeCursor.value.loop === null
  ) {
    return
  }
  if (isComplete) return
  if (runtimeStore.globalLoading) return
  runtimeStore.globalLoading = true
  try {
    // 若计时未暂停，将最后一条片段的 end 更新为当前时刻，确保保存内容最新
    if (!statStore.timerPaused && statStore.segments.length > 0) {
      statStore.segments[statStore.segments.length - 1][1] = Date.now()
    }
    await wordPersistence.save({
      taskWords,
      practiceData: data,
      statStoreData: statStore.$state,
      sessionSnapshot: {
        ...navigator.buildSessionSnapshot(),
      },
    })
    knownCacheUpdatedAt = Math.max(knownCacheUpdatedAt, Date.now())
  } catch (error) {
    console.error('[practice-v2] 保存练习缓存失败', error)
    Toast.error('练习进度保存失败，请稍后重试')
  } finally {
    runtimeStore.globalLoading = false
  }
}

const savePracticeData = debounce(savePracticeDataIns, 500)

function repeat() {
  console.log('重学一遍')
  wordPersistence.clear()
  let temp = cloneDeep(taskWords)
  let ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
  //随机练习单独处理
  if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
    temp.review = shuffle(temp.review.filter(v => !ignoreSet.has(v.word)))
  } else {
    //将学习进度减回去
    store.sdict.lastLearnIndex = store.sdict.lastLearnIndex - statStore.newWordNumber
    //排除已掌握单词
    temp.new = temp.new.filter(v => !ignoreSet.has(v.word))
    temp.review = temp.review.filter(v => !ignoreSet.has(v.word))
  }
  emitter.emit(EventKey.resetWord)
  initData(temp)
}

function prev() {
  if (data.index === 0) {
    Toast.warning('已经是第一个了~')
  } else {
    data.index--
  }
}

function skip() {
  addExcludeWord()
  next(false)
}

function show() {
  typingRef.showWord()
}

function collect() {
  const anchor = typingRef?.getCollectAnchor?.() as HTMLElement | null | undefined
  openWordCollectPicker(word, anchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 }, {
    excludeDictId: store.sdict.id ? String(store.sdict.id) : undefined,
  })
}

function play() {
  typingRef.play()
}

function toggleWordSimpleWrapper() {
  if (!isWordSimple(word)) {
    setTimeout(() => next(false))
  }
  toggleWordSimple(word)
  let rIndex = data.excludeWords.findIndex(v => v === word.word)
  if (rIndex > -1) {
    data.excludeWords.splice(rIndex, 1)
  } else {
    data.excludeWords.push(word.word)
  }
}

function toggleConciseMode() {
  settingStore.showToolbar = !settingStore.showToolbar
  settingStore.showPanel = settingStore.showToolbar
}

async function continueStudy() {
  wordPersistence.clear()
  let temp = cloneDeep(taskWords)
  let ignoreList = [store.allIgnoreWords, store.knownWords][settingStore.ignoreSimpleWord ? 0 : 1]
  //随机练习单独处理
  if (settingStore.wordPracticeMode === WordPracticeMode.Shuffle) {
    const ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
    temp.review = getShufflePracticeWords(
      store.sdict.words,
      {
        total: runtimeStore.routeData?.total ?? temp.review.length,
        range: runtimeStore.routeData?.shuffleRange ?? { start: 0, end: store.sdict.lastLearnIndex },
      },
      ignoreSet
    ).words
  } else {
    //这里判断是否显示结算弹框，如果显示了结算弹框的话，就不用加进度了
    if (!isComplete) {
      console.log('没学完，强行跳过')
      store.sdict.lastLearnIndex = store.sdict.lastLearnIndex + statStore.newWordNumber
      // 忽略单词数
      const ignoreCount = ignoreList.filter(word => store.sdict.words.some(w => w.word.toLowerCase() === word)).length
      // 如果lastLearnIndex已经超过可学单词数，则判定完成
      if (store.sdict.lastLearnIndex + ignoreCount >= store.sdict.length) {
        store.sdict.complete = true
        store.sdict.lastLearnIndex = store.sdict.length
      }
    } else {
      console.log('学完了，正常下一组')
    }

    temp = getCurrentStudyWord()
  }
  emitter.emit(EventKey.resetWord)
  initData(temp)

  if (AppEnv.CAN_REQUEST) {
    let res = await setUserDictProp(null, { ...store.sdict, type: 'word' })
    if (!res.success) {
      Toast.error(res.msg)
    }
  }
}

async function jumpToGroup(group: number) {
  window?.umami?.track('jumpToGroup')
  wordPersistence.clear()
  console.log('没学完，强行跳过', group)
  store.sdict.lastLearnIndex = (group - 1) * store.sdict.perDayStudyNumber
  emitter.emit(EventKey.resetWord)
  initData(getCurrentStudyWord())
  if (AppEnv.CAN_REQUEST) {
    let res = await setUserDictProp(null, { ...store.sdict, type: 'word' })
    if (!res.success) {
      Toast.error(res.msg)
    }
  }
}

function randomWrite() {
  window?.umami?.track('randomWrite')
  console.log('随机默写')
  data.words = shuffle(data.words)
  data.index = 0
  setWordMasked(true)
}

useStartKeyboardEventListener()

watch(isIniting, n => {
  if (!n) {
    watchRefList = [
      watch(() => data.index, savePracticeData),
      // 监听 statStore.spend，每过10秒自动保存数据
      watch(
        () => statStore.spend,
        curr => {
          if (curr % (30 * 1000) === 0 && curr !== 0) {
            savePracticeData()
          }
        }
      ),
    ]
  }
})

function onWordMarkPickComplete(result: WordMarkPickResult) {
  result.know.map(word => {
    data.ratingMap[word.word.toLowerCase()] = Rating.Good
    data.excludeWords.push(word.word)
  })
  result.mastered.map(word => {
    data.excludeWords.push(word.word)
  })
  console.log(result)
  if (result.unknown.length > 0) {
    console.log('当前学完了，但还有错词')
    // 交给当前 Phase 的 onEnd → wrongWordClear action 进入标准错词清空子步骤。
    data.wrongWords = cloneDeep(result.unknown)
    data.allWrongWords = data.allWrongWords.concat(result.unknown.map(v => v.word.toLowerCase()))
    result.unknown.forEach(v => {
      data.wrongTimesMap[v.word.toLowerCase()] = Rating.Good
    })
  } else {
    data.wrongWords = []
  }
  navigator.completeCurrentList()
}

useEvents([
  [EventKey.onTyping, handleResumeTimer],
  [EventKey.repeatStudy, repeat],
  [EventKey.continueStudy, continueStudy],
  //当默写时，执行 show 会标记为错误，并更新卡片
  [ShortcutKey.ShowWord, throttle(show, 300)],
  [ShortcutKey.Previous, prev],
  [ShortcutKey.Next, throttle(() => next(false), 300)],
  [ShortcutKey.Ignore, throttle(skip, 300)],
  [ShortcutKey.ToggleCollect, collect],
  [ShortcutKey.ToggleSimple, toggleWordSimpleWrapper],
  [ShortcutKey.PlayWordPronunciation, play],

  [ShortcutKey.RepeatChapter, repeat],
  [ShortcutKey.NextChapter, continueStudy],
  [ShortcutKey.NextStep, skipStep],
  [ShortcutKey.ToggleShowTranslate, toggleTranslate],
  [ShortcutKey.ToggleDictation, toggleDictation],
  [ShortcutKey.ToggleTheme, toggleTheme],
  [ShortcutKey.ToggleConciseMode, toggleConciseMode],
  [ShortcutKey.ToggleToolbar, () => (settingStore.showToolbar = !settingStore.showToolbar)],
  [ShortcutKey.TogglePanel, () => (settingStore.showPanel = !settingStore.showPanel)],
  [ShortcutKey.RandomWrite, randomWrite],
])
</script>

<template>
  <PracticeLayout v-loading="loading" panelLeft="var(--word-panel-margin-left)">
    <template v-slot:practice>
      <div
        class="practice-word"
        :style="{
          fontSize: settingStore.fontSize.wordTranslateFontSize + 'px',
        }"
      >
        <div class="fixed z-99999 center mt-3" v-if="statStore.timerPaused">
          <ToastComponent
            :duration="0"
            :anim="statStore.timerPauseReason !== 'auto_visibility'"
            :shadow="false"
            :showClose="true"
            :message="statStore.timerPauseReason === 'auto_idle' ? '已连续 3 分钟无键盘操作，计时已暂停' : '计时已暂停'"
            @close="statStore.resumeTimer"
          />
        </div>

        <WordMarkPickList
          v-if="
            currentPracticeType === WordPracticeType.Identify &&
            data.wrongWords.length === 0 &&
            settingStore.identifyMethod === IdentifyMethod.QuickIdentify
          "
          :words="data.words"
          @complete="onWordMarkPickComplete"
        />

        <div class="mb-50 w-full" v-else>
          <!--        前后单词-->
          <div
            class="fixed z-1 top-4 w-full hidden md:block"
            style="left: calc(50vw + var(--aside-width) / 2 - var(--toolbar-width) / 2); width: var(--toolbar-width)"
            v-if="settingStore.showNearWord"
          >
            <Tooltip :title="`上一个(${settingStore.shortcutKeyMap[ShortcutKey.Previous]})`">
              <div class="relative z-2 center gap-2 cp float-left" @click="prev" v-if="prevWord">
                <IconFluentArrowLeft16Regular class="arrow" width="22" />
                <div class="word">{{ prevWord.word }}</div>
              </div>
            </Tooltip>

            <div
              class="center gap-1 absolute w-full cp"
              v-if="settingStore.showConflictNotice2"
              @click="onboardingHostRef?.openConflictNotice2()"
            >
              <IconFluentQuestionCircle20Regular />
              <span class="">无法输入？</span>
            </div>

            <Tooltip :title="`下一个(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`">
              <div class="relative center gap-2 cp float-right mr-3" @click="next(false)" v-if="nextWord">
                <div class="word" :class="effective.isWordMasked && 'word-shadow'">
                  {{ nextWord.word }}
                </div>
                <IconFluentArrowRight16Regular class="arrow" width="22" />
              </div>
            </Tooltip>
          </div>
          <TypeWordV2
            ref="typingRef"
            :word="word"
            :question="data.question"
            :practiceType="currentPracticeType"
            @wrong="onTypeWrong"
            @complete="next"
            @mastered="toggleWordSimpleWrapper"
            @know="onWordKnow"
            @skip="skip"
            @toggle-simple="toggleWordSimpleWrapper"
          />
        </div>
      </div>
    </template>
    <template v-slot:panel>
      <Panel>
        <template v-slot:title>
          <div class="center gap-1">
            <span>{{ store.sdict.name }}</span>

            <GroupList
              @click="jumpToGroup"
              v-if="taskWords.new.length && settingStore.wordPracticeMode !== WordPracticeMode.Shuffle"
            />
            <BaseIcon
              v-if="taskWords.new.length"
              @click="continueStudy"
              :title="`下一组(${settingStore.shortcutKeyMap[ShortcutKey.NextChapter]})`"
            >
              <IconFluentArrowRight16Regular class="arrow" width="22" />
            </BaseIcon>

            <BaseIcon @click="randomWrite" :title="`随机默写(${settingStore.shortcutKeyMap[ShortcutKey.RandomWrite]})`">
              <IconFluentArrowShuffle16Regular class="arrow" width="22" />
            </BaseIcon>
          </div>
        </template>
        <div class="panel-page-item pl-4">
          <WordList
            v-if="data.words.length"
            :is-active="settingStore.showPanel"
            :static="false"
            :show-word="!effective.isWordMasked"
            :show-translate="effective.isShowTranslate"
            :list="data.words"
            :activeIndex="data.index"
            :excludeWords="data.excludeWords"
            :exclude-dict-id="store.sdict.id ? String(store.sdict.id) : undefined"
            @click="(val: any) => (data.index = val.index)"
          >
          </WordList>
          <Empty v-else />
        </div>
      </Panel>
    </template>
    <template v-slot:footer>
      <FooterV2 @skipStep="skipStep" />
    </template>
  </PracticeLayout>
  <StatisticsV2 v-model="isComplete" :loading="settling" />
  <PracticeOnboardingHostV2
    ref="onboardingHostRef"
    :ready="data.words.length > 0"
    :dict-id="String(route.params.id ?? '')"
  />
  <Dialog
    v-model="showRemoteReloadDialog"
    title="检测到其他设备的新进度，是否重新加载？"
    content="重新加载将使用其他设备的最新练习进度；保留当前进度则继续本页练习。"
    confirm-button-text="重新加载"
    cancel-button-text="保留当前进度"
    :footer="true"
    :padding="true"
    :show-close="false"
    :close-on-click-bg="false"
    :on-confirm="reloadRemotePracticeSession"
    @cancel="keepCurrentPracticeSession"
    @close="onRemoteReloadDialogClosed"
  />
</template>

<style scoped lang="scss">
.practice-wrapper {
  @apply w-full h-full flex justify-center overflow-hidden;
}

.practice-word {
  @apply h-full flex flex-col justify-between items-center relative text-2xl;
  width: var(--toolbar-width);
}

// 移动端适配
@media (max-width: 768px) {
  .practice-word {
    width: 100%;

    .absolute.z-1.top-4 {
      z-index: 100; // 提高层级，确保不被遮挡

      .center.gap-2.cursor-pointer {
        min-height: 44px;
        min-width: 44px;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;

        .word {
          pointer-events: none; // 文字不拦截点击
        }

        .arrow {
          pointer-events: none; // 箭头图标不拦截点击
        }
      }
    }
  }
}

.word-panel-wrapper {
  position: absolute;
  left: var(--panel-margin-left);
  //left: 0;
  top: 0.8rem;
  z-index: 1;
  height: calc(100% - 1.5rem);
}
</style>
