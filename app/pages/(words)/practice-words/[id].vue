<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import Statistics from '@/components/word/Statistics.vue'
import { emitter, EventKey, useEvents } from '@/core/utils/eventBus.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import type { Dict, TaskWords, Word } from '@/core/types/types.ts'
import { useStartKeyboardEventListener } from '@/core/hooks/event.ts'
import useTheme from '@/core/hooks/theme.ts'
import { _getDictDataByUrl, resourceWrap, shuffle, throttle } from '@/core/utils'
import { useRoute, useRouter } from 'vue-router'
import Footer from '@/components/word/Footer.vue'
import Panel from '@/components/Panel.vue'
import { BaseIcon, Dialog, Toast, ToastComponent } from '@/base'
import WordList from '@/components/list/WordList.vue'
import TypeWord from '@/components/word/TypeWord.vue'
import Empty from '@/components/Empty.vue'
import { useBaseStore } from '@/core/stores/base.ts'
import { usePracticeStore } from '@/core/stores/practice.ts'
import { getDefaultDict, getDefaultWord } from '@/core/types/func.ts'
import PracticeLayout from '@/components/PracticeLayout.vue'
import PracticeOnboardingHost from '@/components/word/PracticeOnboardingHost.vue'
import { DICT_LIST } from '@/core/config/env.ts'
import GroupList from '@/components/word/GroupList.vue'
import {
  getDefaultPracticeData,
  type PracticeData,
  UnsupportedPracticeCacheVersionError,
  usePracticeWordPersistence,
} from '@/core/composables/practice-words/practice-word-session.ts'
import { useDataSyncPersistence } from '@/core/composables/useDataSyncPersistence.ts'
import { ShortcutKey, WordPracticeMode } from '@/core/types/enum.ts'
import WordMarkPickList, { type WordMarkPickResult } from '@/components/word/WordMarkPickList.vue'
import {
  canAutoResumeVisibilityTimer,
  usePracticeIdleTimer,
} from '@/core/composables/practice-words/usePracticeIdleTimer.ts'
import { createStudyTask } from '@/core/composables/practice-words/study-task.ts'
import PrevAndNextWord from '@/components/word/PrevAndNextWord.vue'
import type { PracticeNotifier } from '@/core/composables/practice-words/practice-flow-types.ts'
import { usePracticeWordSession } from '@/core/composables/practice-words/usePracticeWordSession.ts'

const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const { toggleTheme } = useTheme()
const router = useRouter()
const route = useRoute()
const store = useBaseStore()
const statStore = usePracticeStore()
const dataSync = useDataSyncPersistence()
const wordPersistence = usePracticeWordPersistence()
const onboardingHostRef = ref<InstanceType<typeof PracticeOnboardingHost>>()
const notifyPractice: PracticeNotifier = (level, message) => {
  Toast[level](message)
}
let isComplete = $ref(false)
let loading = $ref(false)
let settling = $ref(false)
let showRemoteReloadDialog = $ref(false)
let remoteCheckInProgress = false
let pendingRemoteUpdatedAt = 0
let knownCacheUpdatedAt = Date.now()
let visibilityResumeTimer: ReturnType<typeof setTimeout> | null = null
let pendingPracticeSaveTimer: ReturnType<typeof setTimeout> | null = null
let practiceSaveInProgress: Promise<void> | null = null
let isQuickMarkWordList = $ref(false)

/** 仅用于 visibilitychange 内 fetch：与 `!document.hidden` 一致 */
const isFocus = ref(true)
let taskWords = $ref<TaskWords>({
  new: [],
  review: [],
})

//watch 实例列表，用于本地代码修改hrm后，导致重复watch
let watchRefList = []
let data = $ref<PracticeData>(getDefaultPracticeData({}))

const word = $computed<Word>(() => {
  return data.words[data.index] ?? getDefaultWord()
})

const session = usePracticeWordSession({
  getPracticeData: () => data,
  setPracticeData: value => (data = value),
  getTaskWords: () => taskWords,
  getAllWords: () => allWords,
  complete,
  scheduleSave: savePracticeData,
  notify: notifyPractice,
})
const { nav } = session
const { activeFlowConfig, activeCursor, currentPhase, currentPracticeType, currentPhaseKey } = nav
const { effective, toggleDictation, toggleTranslate } = session

const { bumpActivity, handleResumeTimer, startTimer, stopTimer } = usePracticeIdleTimer({
  isFocus,
  statStore,
  notify: notifyPractice,
})

provide('practiceData', data)
provide('practiceTaskWords', taskWords)
provide('practiceFlowCursor', activeCursor)
provide('practiceFlowConfig', activeFlowConfig)
provide('bumpPracticeTimerActivity', bumpActivity)

watch([() => data.words, () => data.index, currentPracticeType], () => {
  session.updateQuestion()
  handleResumeTimer()
})

watch([() => word.word, currentPhaseKey], async ([currentWord], [previousWord]) => {
  session.resetCurrentWordState()
  if (!currentWord || currentWord === previousWord) return
  await nextTick()
  window.scrollTo({ top: 0, behavior: 'auto' })
})

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
    cancelScheduledPracticeSave()
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
    // 切回页面时，先等待本机切出页面触发的保存完成。
    // 否则远端可能已经收到本机的新时间戳，而 knownCacheUpdatedAt 尚未更新，造成误报。
    if (practiceSaveInProgress) await practiceSaveInProgress
    const remoteUpdatedAt = await wordPersistence.getRemoteUpdateTime(knownCacheUpdatedAt)
    if (document.hidden || !remoteUpdatedAt) return false
    pendingRemoteUpdatedAt = remoteUpdatedAt
    showRemoteReloadDialog = true
    return true
  } catch (error) {
    if (error instanceof UnsupportedPracticeCacheVersionError) {
      Toast.error('远端练习缓存来自更高版本，请升级后再继续')
    } else {
      console.error('[practice] 检查远端练习进度失败', error)
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
    const previousWord = word
    const cache = await wordPersistence.load()
    knownCacheUpdatedAt = Math.max(knownCacheUpdatedAt, pendingRemoteUpdatedAt, Date.now())
    pendingRemoteUpdatedAt = 0
    if (!cache) {
      Toast.warning('远端练习已结束或缓存已清空')
      await router.push('/words')
      return true
    }
    if (!session.applyPracticeCache(cache)) {
      Toast.error('远端练习进度无效，无法重新加载')
      return false
    }
    resetSameWordAfterViewUpdate(previousWord)
    Toast.success('已加载其他设备的最新进度')
    return true
  } catch (error) {
    if (error instanceof UnsupportedPracticeCacheVersionError) {
      Toast.error('远端练习缓存来自更高版本，请升级后再继续')
    } else {
      console.error('[practice] 加载远端练习进度失败', error)
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

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  clearVisibilityResumeTimer()
  cancelScheduledPracticeSave()
  stopTimer()
  watchRefList.map(v => v?.stop())
  if (!showRemoteReloadDialog) void savePracticeDataIns()
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
        await router.push('/words')
        return
      }
    }
    if (!d) {
      initData(createStudyTask().taskWords)
      return
    }
    if (!session.applyPracticeCache(d)) {
      initData(d.taskWords)
      return
    }
    console.log('initData')
  } else {
    console.log('initData')
    //不能直接赋值，会导致 inject 的数据为默认值
    if (!session.initializeTask(initVal)) {
      Toast.warning('没有可学习的单词！')
      router.push('/words')
      return
    }
  }

  // 初始化 Question
  let dictId: any = route.params.id
  let d = store.word.bookList.find(v => v.id === dictId)
  if (!d) d = store.sdict
  if (!d?.id) return router.push('/words')
  allWords = shuffle(d.words)
  session.updateQuestion()

  startTimer()
  knownCacheUpdatedAt = Math.max(knownCacheUpdatedAt, Date.now())
  isIniting.value = false
  settling = isComplete = false
}

/**
 * 会话切换后，新的 Word 引用会由 TypeWord 的 props watcher 自动重置。
 * 若切换前后仍是同一个引用（如“重学一遍”），则等新会话 props 刷新后补发重置事件。
 */
function resetSameWordAfterViewUpdate(previousWord: Word) {
  const targetWord = word
  if (targetWord !== previousWord) return
  nextTick(() => {
    if (word === targetWord) emitter.emit(EventKey.resetWord)
  })
}

// 显隐与阶段同步由 Registry applyPhase 负责（Phase 2）
async function complete() {
  if (!isComplete) {
    let start = Date.now()
    console.log('全完学完了')
    statStore.wrong = data.allWrongWords.length
    isComplete = true
    settling = true
    runtimeStore.globalLoading = true
    stopTimer()

    // 先让结算弹框及“结算中”状态完成渲染，再执行统计、FSRS 和持久化。
    // 仅 nextTick 会在浏览器绘制前继续执行微任务；双 rAF 确保至少完成一帧绘制。
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    try {
      session.settleLocalPractice()

      try {
        await dataSync.saveDictState(store.$state, { pullWhenRemoteNewer: false })
      } catch (error) {
        console.error('[practice] 远端结算同步失败', error)
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
      console.error('[practice] 本地结算失败', error)
      Toast.error('结算失败，请重试')
    } finally {
      settling = false
      runtimeStore.globalLoading = false
    }
  }
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
  if (practiceSaveInProgress) return await practiceSaveInProgress
  if (runtimeStore.globalLoading) return

  const saveTask = (async () => {
    runtimeStore.globalLoading = true
    try {
      // 若计时未暂停，将最后一条片段的 end 更新为当前时刻，确保保存内容最新
      if (!statStore.timerPaused && statStore.segments.length > 0) {
        statStore.segments[statStore.segments.length - 1][1] = Date.now()
      }
      session.reconcilePracticeTimer()
      await wordPersistence.save({
        taskWords,
        practiceData: data,
        statStoreData: statStore.$state,
        sessionSnapshot: {
          ...nav.buildSessionSnapshot(),
        },
      })
      knownCacheUpdatedAt = Math.max(knownCacheUpdatedAt, Date.now())
    } catch (error) {
      console.error('[practice] 保存练习缓存失败', error)
      Toast.error('练习进度保存失败，请稍后重试')
    } finally {
      runtimeStore.globalLoading = false
    }
  })()

  practiceSaveInProgress = saveTask
  try {
    await saveTask
  } finally {
    if (practiceSaveInProgress === saveTask) practiceSaveInProgress = null
  }
}

function cancelScheduledPracticeSave() {
  if (pendingPracticeSaveTimer) clearTimeout(pendingPracticeSaveTimer)
  pendingPracticeSaveTimer = null
}

function savePracticeData() {
  cancelScheduledPracticeSave()
  pendingPracticeSaveTimer = setTimeout(() => {
    pendingPracticeSaveTimer = null
    void savePracticeDataIns()
  }, 500)
}

function toggleConciseMode() {
  settingStore.showToolbar = !settingStore.showToolbar
  settingStore.showPanel = settingStore.showToolbar
}

async function repeat() {
  const previousWord = word
  console.log('重学一遍')
  wordPersistence.clear()
  await initData(session.createRepeatTask())
  resetSameWordAfterViewUpdate(previousWord)
}

async function continueStudy() {
  const previousWord = word
  wordPersistence.clear()
  const temp = session.createNextTask(isComplete)
  if (!temp.new.length && !temp.review.length) {
    Toast.warning('当前没有可学习的单词')
    return
  }
  await initData(temp)
  resetSameWordAfterViewUpdate(previousWord)
}

async function jumpToGroup(group: number) {
  const previousWord = word
  window?.umami?.track('jumpToGroup')
  wordPersistence.clear()
  console.log('没学完，强行跳过', group)
  await initData(session.createTaskFromGroup(group))
  resetSameWordAfterViewUpdate(previousWord)
}

function randomWrite() {
  window?.umami?.track('randomWrite')
  console.log('随机默写')
  session.randomWrite()
}

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
  session.onWordMarkPickComplete(result)
  isQuickMarkWordList = false
}

useStartKeyboardEventListener()

useEvents([
  [EventKey.onTyping, handleResumeTimer],
  [EventKey.repeatStudy, repeat],
  [EventKey.continueStudy, continueStudy],
  [ShortcutKey.Previous, nav.prev],
  [ShortcutKey.Next, throttle(() => nav.next(false), 300)],
  [ShortcutKey.Ignore, throttle(session.skip, 300)],
  [ShortcutKey.ToggleSimple, session.toggleWordSimpleForCurrent],
  [ShortcutKey.RepeatChapter, repeat],
  [ShortcutKey.NextChapter, continueStudy],
  [ShortcutKey.NextStep, nav.skipStep],
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
          v-if="isQuickMarkWordList"
          :words="data.words"
          @complete="onWordMarkPickComplete"
          @back="isQuickMarkWordList = false"
        />

        <div class="mb-50 w-full" v-else>
          <PrevAndNextWord
            :data="data"
            :isWordMasked="effective.isWordMasked"
            @next="nav.next(false)"
            @prev="nav.prev"
            @openNotice="onboardingHostRef?.openConflictNotice2"
          />
          <TypeWord
            :word="word"
            :question="data.question"
            :practiceType="currentPracticeType"
            :phaseKey="currentPhaseKey"
            @complete="nav.next"
            @wrong="session.onTypeWrong"
            @mastered="session.onWordMastered"
            @know="session.onWordKnow"
            @skip="session.skip"
            @quickMark="isQuickMarkWordList = true"
            @toggle-simple="session.toggleWordSimpleForCurrent"
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
      <Footer @skipStep="nav.skipStep" />
    </template>
  </PracticeLayout>
  <Statistics v-model="isComplete" :loading="settling" />
  <PracticeOnboardingHost
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

@media (max-width: 768px) {
  .practice-word {
    width: 100%;

    .absolute.z-1.top-4 {
      /* // 提高层级，确保不被遮挡*/
      z-index: 100;

      .center.gap-2.cursor-pointer {
        min-height: 44px;
        min-width: 44px;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;

        .word {
          /*// 文字不拦截点击*/
          pointer-events: none;
        }

        .arrow {
          /*// 箭头图标不拦截点击*/
          pointer-events: none;
        }
      }
    }
  }
}

.word-panel-wrapper {
  position: absolute;
  left: var(--panel-margin-left);
  top: 0.8rem;
  z-index: 1;
  height: calc(100% - 1.5rem);
}
</style>
