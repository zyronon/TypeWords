<script setup lang="ts">
import { onMounted, onUnmounted, provide, watch } from 'vue'
import StatisticsV2 from '~/components/practice-words-v2/StatisticsV2.vue'
import { emitter, EventKey, useEvents } from '@typewords/core/utils/eventBus.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { useRuntimeStore } from '@typewords/core/stores/runtime.ts'
import type { Dict, PracticeData, TaskWords, Word } from '@typewords/core/types/types.ts'
import { usePracticeWordKeyboard } from '~/composables/practice-words/usePracticeWordKeyboard.ts'
import { usePracticeDisplayPolicy, displayOverride } from '~/composables/practice-words/usePracticeDisplayPolicy.ts'
import {
  activeCursor,
  buildSessionSnapshot,
  createPracticeWordNavigator,
  resetCursor,
  restoreSessionFromLegacy,
  restoreSessionSnapshot,
} from '~/composables/practice-words/usePracticeWordNavigator.ts'
import { loadPracticeFlow } from '~/composables/practice-words/practice-phase-registry.ts'
import { getFlowIdForMode } from '~/composables/practice-words/builtin-flows.ts'
import { resolveFlowStart } from '~/composables/practice-words/usePracticeWordInit.ts'
import useTheme from '@typewords/core/hooks/theme.ts'
import { getCurrentStudyWord, useWordOptions } from '@typewords/core/hooks/dict.ts'
import { openWordCollectPicker } from '@typewords/core/hooks/useWordCollectPicker.ts'
import {
  _getDictDataByUrl,
  _nextTick,
  cloneDeep,
  debounce,
  getShufflePracticeWords,
  isMobile,
  loadJsLib,
  resourceWrap,
  shuffle,
  throttle,
} from '@typewords/core/utils'
import { useRoute, useRouter } from 'vue-router'
import FooterV2 from '~/components/practice-words-v2/FooterV2.vue'
import Panel from '@typewords/core/components/Panel.vue'
import { BaseIcon, Toast, ToastComponent, Tooltip } from '@typewords/base'
import WordList from '@typewords/core/components/list/WordList.vue'
import TypeWordV2 from '~/components/practice-words-v2/TypeWordV2.vue'
import Empty from '@typewords/core/components/Empty.vue'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'
import { getDefaultDict, getDefaultWord } from '@typewords/core/types/func.ts'
import ConflictNotice from '@typewords/core/components/dialog/ConflictNotice.vue'
import PracticeLayout from '@typewords/core/components/PracticeLayout.vue'
import { AppEnv, DICT_LIST, LIB_JS_URL, TourConfig } from '@typewords/core/config/env.ts'
import { watchOnce } from '@vueuse/core'
import { addStat, setUserDictProp } from '@typewords/core/apis'
import GroupList from '@typewords/core/components/word/GroupList.vue'
import { getPracticeWordCacheV2Local } from '~/composables/practice-words/practice-word-cache-v2.ts'
import { usePracticeWordPersistenceV2 } from '~/composables/practice-words/usePracticeWordPersistenceV2.ts'
import { getDefaultPracticeData } from '~/composables/practice-words/types.ts'
import { flushStatToStore } from '@typewords/core/composables/usePracticePersistence.ts'
import { useDataSyncPersistence } from '@typewords/core/composables/useDataSyncPersistence.ts'
import {
  IdentifyMethod,
  ShortcutKey,
  WordPracticeMode,
  WordPracticeType,
} from '@typewords/core/types/enum.ts'
import ConflictNotice2 from '@typewords/core/components/dialog/ConflictNotice2.vue'
import { createEmptyCard, Rating } from 'ts-fsrs'
import { useGetGradeByWrongTimes, useNextCard } from '@typewords/core/hooks/fsrs.ts'
import WordMarkPickList, { type WordMarkPickResult } from '@typewords/core/components/word/WordMarkPickList.vue'
import { buildQuestion } from '@typewords/core/utils/word-test.ts'
import CollectNotice from '@typewords/core/components/dialog/CollectNotice.vue'
import type { PracticeSessionSnapshot } from '~/composables/practice-words/registry-types.ts'

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
const { effective, toggleDictation, toggleTranslate } = usePracticeDisplayPolicy()
let { getGradeByWrongTimes } = useGetGradeByWrongTimes()
let { nextCard } = useNextCard()
const typingRef: any = $ref()
let showConflictNotice = $ref(false)
let showCollectNotice = $ref(false)
let showConflictNotice2 = $ref(false)
let isComplete = $ref(false)
let loading = $ref(false)
let settling = $ref(false)
let timer = $ref<any>(-1)
/** 仅用于 visibilitychange 内 fetch：与 `!document.hidden` 一致 */
let isFocus = true
const IDLE_MS = 3 * 60 * 1000
let lastKeyActivity = Date.now()
let taskWords = $ref<TaskWords>({
  new: [],
  review: [],
})

//watch 实例列表，用于本地代码修改hrm后，导致重复watch
let watchRefList = []
let data = $ref<PracticeData>(getDefaultPracticeData({}))

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

function next(isTyping: boolean = true, ignoreLoop = false) {
  navigator.next(isTyping, ignoreLoop)
}

function skipStep() {
  navigator.skipStep()
}

function syncSessionPhase() {
  loadPracticeFlow(getFlowIdForMode(settingStore.wordPracticeMode))
  navigator.syncPhase()
}

function restorePracticeSession(cache: { sessionSnapshot?: PracticeSessionSnapshot }) {
  if (cache.sessionSnapshot) {
    restoreSessionSnapshot(cache.sessionSnapshot, data, taskWords)
  } else {
    restoreSessionFromLegacy(data, taskWords)
  }
}

watch(
  () => data.words,
  () => {
    updateQuestion()
    handleResumeTimer()
  }
)
watch(
  () => data.index,
  () => {
    updateQuestion()
    handleResumeTimer()
  }
)

function updateQuestion() {
  if (data.words?.[data.index]) {
    data.question = buildQuestion(data.words[data.index], allWords)
  }
}

provide('practiceData', data)
provide('practiceTaskWords', taskWords)

function bumpPracticeTimerActivity() {
  lastKeyActivity = Date.now()
}
provide('bumpPracticeTimerActivity', bumpPracticeTimerActivity)

function handleResumeTimer() {
  if (!isFocus) return
  if (statStore.timerPaused) {
    statStore.resumeTimer()
    Toast.success('已恢复计时')
  }
  bumpPracticeTimerActivity()
}

async function loadDict() {
  // console.log('load好了开始加载')
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

watch(
  [() => store.load, () => loading],
  ([a, b]) => {
    if (a && b) loadDict()
  },
  { immediate: true }
)

const onvisibilitychange = async () => {
  isFocus = !document.hidden
  if (isFocus) {
    bumpPracticeTimerActivity()
    if (statStore.timerPaused && statStore.timerPauseReason === 'auto_visibility') {
      //特意延迟提示用户，让用户看到，免得用户焦虑，以为没暂停
      setTimeout(() => {
        statStore.resumeTimer()
        Toast.success('已自动恢复计时')
      }, 1500)
    }
    if (runtimeStore.globalLoading) return
    runtimeStore.globalLoading = true
    try {
      //todo 这里如果另一台机器学完了，这里的d可能为空
      const d = await wordPersistence.fetch()
      if (d) {
        taskWords = Object.assign(taskWords, d.taskWords)
        data = Object.assign(data, d.practiceData)
        statStore.$patch(d.statStoreData)
        restorePracticeSession(d)
        if (!statStore.timerPaused) {
          const now = Date.now()
          statStore.segments.push([now, now])
        }
      }
    } finally {
      runtimeStore.globalLoading = false
    }
  } else {
    statStore.pauseTimer('auto_visibility')
  }
}

onMounted(async () => {
  //如果是从单词学习主页过来的，就直接使用；否则等待加载
  if (runtimeStore.routeData) {
    await initData(null, true)
  } else {
    loading = true
  }
  if (!route.query.guide) {
    showConflictNotice = true
    setTimeout(() => {
      showCollectNotice = true
    }, 10000)
  }
  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)
})

onUnmounted(async () => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  const cache = await getPracticeWordCacheV2Local()
  if (cache) {
    await savePracticeDataIns('onUnmounted')
  }
  timer && clearInterval(timer)
  watchRefList.map(v => v?.stop())
})

watchOnce(
  () => data.words.length,
  (newVal, oldVal) => {
    //如果是从无值变有值，代表是开始
    if (!oldVal && newVal) {
      _nextTick(async () => {
        const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
        const tour = new Shepherd.Tour(TourConfig)
        tour.on('cancel', () => {
          localStorage.setItem('tour-guide', '1')
        })
        tour.addStep({
          id: 'step5',
          text: '这里可以练习拼写单词，只需要按下键盘上对应的按键即可，没有输入框！',
          attachTo: { element: '#word', on: 'bottom' },
          buttons: [
            {
              text: `关闭`,
              action() {
                settingStore.first = false
                tour.next()
                setTimeout(() => {
                  showConflictNotice = true
                }, 1500)
                setTimeout(() => {
                  showCollectNotice = true
                }, 10000)
              },
            },
          ],
        })

        const r = localStorage.getItem('tour-guide')
        if (settingStore.first && !r && !isMobile()) {
          tour.start()
        }
      }, 500)
    }
  }
)

let allWords: Word[] = []

let isIniting = ref(true)
async function initData(initVal?: TaskWords, init: boolean = false) {
  isIniting.value = true
  //只有初始化时，才读取缓存（本地 + 可选 Supabase）
  if (init) {
    let d = runtimeStore.routeData
    if (!d) {
      d = await wordPersistence.load()
    }
    if (!d) {
      initData(getCurrentStudyWord())
      return
    }
    if (!(d.practiceData && d.statStoreData)) {
      initData(d.taskWords)
      return
    }
    console.log('initData')
    taskWords = Object.assign(taskWords, d.taskWords)
    //这里直接赋值的话，provide后的inject获取不到最新值
    data = getDefaultPracticeData(data, d.practiceData)
    statStore.$patch(d.statStoreData)
    restorePracticeSession(d)
    if (!statStore.timerPaused) {
      const now = Date.now()
      statStore.segments.push([now, now])
    }
  } else {
    console.log('initData')
    // taskWords = initVal
    //不能直接赋值，会导致 inject 的数据为默认值
    taskWords = Object.assign(taskWords, initVal)
    try {
      const start = resolveFlowStart(settingStore.wordPracticeMode, taskWords)
      settingStore.wordPracticeType = start.practiceType
      data = getDefaultPracticeData(data, { words: start.words })
    statStore.total = start.total
      statStore.newWordNumber = start.newWordNumber
      statStore.reviewWordNumber = start.reviewWordNumber
      // 重置 cursor 到 flow 起始位置
      resetCursor()
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
    syncSessionPhase()
  }

  // 初始化 Question
  let dictId: any = route.params.id
  let d = store.word.bookList.find(v => v.id === dictId)
  if (!d) d = store.sdict
  if (!d?.id) return router.push('/words')
  allWords = shuffle(d.words)
  updateQuestion()

  clearInterval(timer)
  bumpPracticeTimerActivity()
  timer = setInterval(() => {
    if (!isFocus) return
    if (statStore.timerPaused) return

    const now = Date.now()
    if (now - lastKeyActivity >= IDLE_MS) {
      return statStore.pauseTimer('auto_idle')
    }
    statStore.spend += 1000
  }, 1000)
  isIniting.value = false
  settling = isComplete = false
}

const word = $computed<Word>(() => {
  return data.words[data.index] ?? getDefaultWord()
})
const prevWord: Word = $computed(() => {
  return data.words?.[data.index - 1] ?? undefined
})
const nextWord: Word = $computed(() => {
  return data.words?.[data.index + 1] ?? undefined
})

// 显隐与阶段同步由 Registry applyPhase 负责（Phase 2）

async function complete() {
  if (!isComplete) {
    let start = Date.now()
    console.log('全完学完了')
    isComplete = true
    settling = true
    runtimeStore.globalLoading = true
    clearInterval(timer)

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

    if (AppEnv.CAN_REQUEST) {
      let res = await addStat({
        ...data,
        type: 'word',
        perDayStudyNumber: store.sdict.perDayStudyNumber,
        lastLearnIndex: store.sdict.lastLearnIndex,
        complete: store.sdict.complete,
      })
      if (!res.success) {
        Toast.error(res.msg)
      }
    }

    await dataSync.saveDictState(store.$state, { pullWhenRemoteNewer: false })
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
    settling = false
    runtimeStore.globalLoading = false
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
  savePracticeData('wrong')
}

//设置单词卡片
function setWordCard(rating: number, wordStr = word.word, times?: number) {
  let card = store.fsrsData[wordStr]
  if (!card) {
    card = createEmptyCard()
  }
  card = nextCard(card, rating)
  store.fsrsData[wordStr] = card
  // console.log(
  //   `更新卡片: 单词：${wordStr}, 模式：${WordPracticeType[settingStore.wordPracticeType]}, 评分: ${Rating[rating]}, 次数：${times}, 卡片: `,
  //   card,
  //   cloneDeep(store.fsrsData)
  // )
}

async function savePracticeDataIns(where?) {
  // cursor 在初始位置且 index=0 且还是跟写 → 尚未开始练习
  if (
    data.index === 0 &&
    activeCursor.value.nodeIndex === 0 &&
    activeCursor.value.stepIndex === 0 &&
    !activeCursor.value.spellSubStep &&
    !activeCursor.value.wrongRetry
  ) {
    return
  }
  if (isComplete) return
  // console.log('savePracticeData', where)
  if (runtimeStore.globalLoading) return
  runtimeStore.globalLoading = true
  // 若计时未暂停，将最后一条片段的 end 更新为当前时刻，确保保存内容最新
  if (!statStore.timerPaused && statStore.segments.length > 0) {
    statStore.segments[statStore.segments.length - 1][1] = Date.now()
  }
  await wordPersistence.save({
    taskWords,
    practiceData: data,
    statStoreData: statStore.$state,
    sessionSnapshot: buildSessionSnapshot(data),
  })
  runtimeStore.globalLoading = false
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

function show(e: KeyboardEvent) {
  typingRef.showWord()
}

function collect(e: KeyboardEvent) {
  const anchor = typingRef?.getCollectAnchor?.() as HTMLElement | null | undefined
  openWordCollectPicker(
    word,
    anchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 },
    { excludeDictId: store.sdict.id ? String(store.sdict.id) : undefined }
  )
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
  displayOverride.value = {
    wordMask: 'underscore',
    showSentences: false,
    showWordTranslation: true,
    showSentenceTranslation: true,
  }
}

usePracticeWordKeyboard()

watch(isIniting, n => {
  if (!n) {
    watchRefList = [
      watch(() => data.index, savePracticeData),
      // 监听 statStore.spend，每过10秒自动保存数据
      watch(
        () => statStore.spend,
        curr => {
          if (curr % (30 * 1000) === 0 && curr !== 0) {
            savePracticeData('spend')
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
    data.isTypingWrongWord = true
    console.log('当前学完了，但还有错词')
    data.words = shuffle(cloneDeep(result.unknown))
    data.index = 0
    data.wrongWords = []
    syncSessionPhase()

    data.allWrongWords = data.allWrongWords.concat(result.unknown.map(v => v.word.toLowerCase()))
    result.unknown.forEach(v => {
      data.wrongTimesMap[v.word.toLowerCase()] = 1
    })
  } else {
    data.words = []
    next(false)
  }
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
      <div class="practice-word">
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
            settingStore.wordPracticeType === WordPracticeType.Identify &&
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
              @click="showConflictNotice2 = true"
            >
              <IconFluentQuestionCircle20Regular />
              <span class="">无法输入？</span>
            </div>

            <Tooltip :title="`下一个(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`">
              <div class="relative center gap-2 cp float-right mr-3" @click="next(false)" v-if="nextWord">
                <div class="word" :class="effective.dictation && 'word-shadow'">
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
              v-if="
                taskWords.new.length &&
                ![WordPracticeMode.Review, WordPracticeMode.Shuffle].includes(settingStore.wordPracticeMode)
              "
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
            :show-word="!effective.dictation"
            :show-translate="effective.translate"
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
  <ConflictNotice v-if="showConflictNotice" />
  <CollectNotice v-model="showCollectNotice" />
  <ConflictNotice2 v-model="showConflictNotice2" />
</template>

<style scoped lang="scss">
.practice-wrapper {
  @apply w-full h-full flex justify-center overflow-hidden;
}

.practice-word {
  @apply h-full flex flex-col justify-between items-center relative;
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
