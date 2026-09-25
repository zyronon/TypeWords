<script setup lang="ts">
import { useBaseStore } from '@/core/stores/base.ts'
import { useRouter } from 'vue-router'
import {
  BaseButton,
  BaseIcon,
  BasePage,
  Calendar,
  DeleteIcon,
  Dialog,
  OptionButton,
  PopConfirm,
  Progress,
  Switch,
  Toast,
  Tooltip,
} from '@/base'
import {
  _getAccomplishDate,
  _getDictDataByUrl,
  _nextTick,
  debounce,
  getShufflePracticeWords,
  isMobile,
  loadJsLib,
  msToHourMinute,
  resourceWrap,
  type ShufflePracticeSetting,
  total,
  useNav,
} from '@/core/utils'
import type { DictResource, Statistics } from '@/core/types/types.ts'
import { onMounted, onUnmounted, watch } from 'vue'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import Book from '@/components/Book.vue'
import { getDefaultDict } from '@/core/types/func.ts'
import PracticeSettingDialog from '@/components/word/PracticeSettingDialog.vue'
import ChangeLastPracticeIndexDialog from '@/components/word/ChangeLastPracticeIndexDialog.vue'
import { useSettingStore } from '@/core/stores/setting.ts'
import { useFetch } from '@vueuse/core'
import {
  APP_NAME,
  DICT_LIST,
  LIB_JS_URL,
  Old_Host,
  Origin,
  TourConfig,
  WordPracticeModeNameMap,
  WordPracticeModeUrlMap,
} from '@/core/config/env.ts'
import PracticeWordListDialog from '@/components/word/PracticeWordListDialog.vue'
import ShufflePracticeSettingDialog from '@/components/word/ShufflePracticeSettingDialog.vue'
import { flushStatToStore } from '@/core/composables/usePracticePersistence'
import { useDataSyncPersistence } from '@/core/composables/useDataSyncPersistence'
import { WordPracticeMode } from '@/core/types/enum.ts'
import {
  type PracticeWordCache,
  UnsupportedPracticeCacheVersionError,
  usePracticeWordPersistence,
} from '@/core/composables/practice-words/practice-word-session.ts'
import dayjs from 'dayjs'
import { getActiveCustomFlowId, getUserFlow } from '@/core/composables/practice-words/practice-flow-runtime.ts'
import { createStudyTask } from '@/core/composables/practice-words/study-task.ts'

const store = useBaseStore()
const settingStore = useSettingStore()
const wordPersistence = usePracticeWordPersistence()
const dataSync = useDataSyncPersistence()
const router = useRouter()
const { nav } = useNav()
const runtimeStore = useRuntimeStore()
let loading = $ref(true)
let isSaveData = $ref(false)
let unsupportedCacheVersion = false

async function loadPracticeCache() {
  try {
    return await wordPersistence.load()
  } catch (error) {
    if (!(error instanceof UnsupportedPracticeCacheVersionError)) throw error
    unsupportedCacheVersion = true
    Toast.error('The practice cache is from a newer version. Please upgrade to continue')
    return null
  }
}

const shouldShowDialogPracticeMode = [WordPracticeMode.Shuffle, WordPracticeMode.ShuffleWordsTest]

useSeoMeta({
  title: `Online Vocabulary & English Typing Practice | ${APP_NAME}`,
  description: 'Choose from CET-4, CET-6, postgraduate exam, GRE, IELTS and more word lists, and memorize vocabulary efficiently on your computer with typing, spelling, and spaced repetition review.',
  ogTitle: `Online Vocabulary & English Typing Practice | ${APP_NAME}`,
  ogDescription: 'Learn vocabulary by typing on your computer, with 50+ word lists and spaced repetition review.',
  twitterTitle: `Online Vocabulary & English Typing Practice | ${APP_NAME}`,
  twitterDescription: 'Learn vocabulary by typing on your computer, with 50+ word lists and spaced repetition review.',
})

let practiceData = $ref<PracticeWordCache>({
  taskWords: {
    new: [],
    review: [],
  },
} as any)
let dueReviewCount = $ref(0)

function refreshStudyTask() {
  const result = createStudyTask()
  practiceData.taskWords = result.taskWords
  dueReviewCount = result.dueReviewCount
  return result
}

function toggleAutoAddRandomReview(enabled: boolean) {
  settingStore.autoAddRandomReviewWhenNoDue = enabled
  const result = refreshStudyTask()
  if (!enabled) return
  if (result.randomReviewCount > 0) {
    Toast.success(`Added ${result.randomReviewCount} random review words to this session`)
  } else {
    Toast.warning('No words to review yet. Learn some new words first, then come back')
  }
}

const effectiveReviewRatio = $computed(() => {
  const dict = store.sdict
  const isEnd = dict.length !== 1 && dict.lastLearnIndex >= dict.length - 1
  return isEnd ? settingStore.wordReviewRatio || 1 : settingStore.wordReviewRatio
})

const reviewWordLimit = $computed(() => {
  return Math.max(0, Math.floor(store.sdict.perDayStudyNumber * effectiveReviewRatio))
})

const reviewWordTip = $computed(() => {
  const dailyGoal = store.sdict.perDayStudyNumber
  const actualCount = practiceData?.taskWords?.review?.length ?? 0
  const rule = `Review words are learned words due today or earlier according to the memory curve, excluding this group's new words, mastered words, and ignored words. The "${effectiveReviewRatio}x" ratio only sets the upper limit: daily new-word goal ${dailyGoal} × ${effectiveReviewRatio}, so at most ${reviewWordLimit} in this group.\n`

  if (isSaveData) {
    return `${rule}This is an unfinished task that was already generated, with ${actualCount} review words;\nthe actual count depends on the eligible due words when the task was generated, and is not filled up with words that are not yet due.`
  }
  if (reviewWordLimit === 0) {
    return `${rule}The current limit is 0, so no review words are scheduled for this group.`
  }
  if (dueReviewCount === 0 && actualCount > 0) {
    return `${rule}There are no due review words, so ${actualCount} random learned words were added based on the "Add random review" setting.`
  }
  if (actualCount < reviewWordLimit) {
    return `${rule}Only ${actualCount} eligible due words are available, so ${actualCount} are scheduled for this group; it is not filled up with words that are not yet due.`
  }
  return `${rule}${actualCount} are scheduled for this group, which reaches the limit.`
})

async function resetCacheData() {
  if (unsupportedCacheVersion) return
  isSaveData && flushStatToStore(practiceData.statStoreData)
  isSaveData = false
  practiceData.practiceData = null
  practiceData.statStoreData = null
  practiceData.sessionSnapshot = undefined
  await wordPersistence.clear()
}

// runtimeStore.globalLoading练习界面，退出时会调用一个保存，可能会卡住。当调用完成再init
//  immediate: true 比 onUmMounted 先执行，只能延时执行
watch(
  [() => store.load, () => runtimeStore.globalLoading],
  debounce(([a, b]) => {
    if (a && !b) {
      init()
      _nextTick(async () => {
        const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
        const tour = new Shepherd.Tour(TourConfig)
        tour.on('cancel', () => {
          localStorage.setItem('tour-guide', '1')
        })
        tour.addStep({
          id: 'step1',
          text: 'Click here to choose a dictionary and start learning',
          attachTo: {
            element: '#step1',
            on: 'bottom',
          },
          buttons: [
            {
              text: `Next (1/${TourConfig.total})`,
              action() {
                tour.next()
                router.push('/dict-list')
              },
            },
          ],
        })
        const r = localStorage.getItem('tour-guide')
        if (settingStore.first && !r && !isMobile()) tour.start()
      }, 500)
    }
  }),
  { immediate: true }
)

async function onvisibilitychange() {
  if (!document.hidden) {
    //当页面可见时，检查是否需要从缓存恢复
    const d = await loadPracticeCache()
    if (d) {
      practiceData = d
      isSaveData = true
    }
  }
}

async function init() {
  document.removeEventListener('visibilitychange', onvisibilitychange)
  document.addEventListener('visibilitychange', onvisibilitychange)

  let studyIndex = store.word.studyIndex
  if (studyIndex >= 3) {
    if (!store.sdict.custom && !store.sdict.words.length) {
      let dictList = await fetch(resourceWrap(DICT_LIST.WORD.ALL)).then(r => r.json())
      let dict = await _getDictDataByUrl(store.sdict)
      let r = dictList.find(v => [v.enName, v.id].includes(store.sdict.id))
      if (r) {
        store.word.bookList[studyIndex].words = dict.words
        store.word.bookList[studyIndex].id = r.id
        store.word.bookList[studyIndex].enName = r.enName
        store.word.bookList[studyIndex].cover = r.cover
        store.word.bookList[studyIndex].category = r.category
        store.word.bookList[studyIndex].tags = r.tags
        store.word.bookList[studyIndex].url = r.url
        store.word.bookList[studyIndex].description = r.description
        store.word.bookList[studyIndex].name = r.name
      } else {
        store.word.bookList[studyIndex] = dict
      }
      store.word.bookList[studyIndex].length = dict.words.length
      let s = store.word.bookList[studyIndex]
      if (s.lastLearnIndex > s.length) {
        store.word.bookList[studyIndex].lastLearnIndex = s.length
        store.word.bookList[studyIndex].complete = true
        await resetCacheData()
      }
    }
  }

  if (!practiceData?.taskWords.new.length && store.sdict.words.length) {
    const d = await loadPracticeCache()
    if (d) {
      practiceData = d
      isSaveData = true
    } else if (!unsupportedCacheVersion) {
      refreshStudyTask()
    }
  }
  loading = false
}

async function startPractice(practiceMode: WordPracticeMode, resetCache: boolean = false): Promise<void> {
  if (unsupportedCacheVersion) {
    Toast.error('This client cannot read this practice cache. Please upgrade to continue')
    return
  }
  if (practiceMode === WordPracticeMode.Custom) {
    const activeCustomFlowId = getActiveCustomFlowId()
    if (!activeCustomFlowId || !getUserFlow(activeCustomFlowId)) {
      Toast.warning('Please create and activate a custom flow first')
      router.push('/practice-flow-editor')
      return
    }
  }
  if (resetCache) await resetCacheData()

  if (shouldShowDialogPracticeMode.includes(practiceMode) && !isSaveData) {
    editingWordPracticeMode = practiceMode
    showShufflePracticeSettingDialog = true
    return
  }

  if (store.sdict.id) {
    if (!store.sdict.words.length) {
      Toast.warning('No words to study!')
      return
    }

    settingStore.wordPracticeMode = practiceMode

    window.umami?.track('startStudyWord', {
      name: store.sdict.name,
      index: String(store.sdict.lastLearnIndex),
      perDayStudyNumber: String(store.sdict.perDayStudyNumber),
      custom: store.sdict.custom,
      complete: store.sdict.complete,
      wordPracticeMode: String(settingStore.wordPracticeMode),
    })
    //把是否是第一次设置为false
    if (settingStore.first) settingStore.first = false
    nav(WordPracticeModeUrlMap[practiceMode] + '/' + store.sdict.id, {}, practiceData)
  } else {
    window.umami?.track('no-dict')
    Toast.warning('Please select a dictionary first')
  }
}

function freePractice() {
  startPractice(WordPracticeMode.Free, settingStore.wordPracticeMode !== WordPracticeMode.Free)
}

function systemPractice() {
  const currentMode = settingStore.wordPracticeMode
  const isFree = currentMode === WordPracticeMode.Free
  startPractice(isFree ? WordPracticeMode.System : currentMode, isFree)
}

let editingWordPracticeMode = $ref(0)

let showPracticeSettingDialog = $ref(false)
let showShufflePracticeSettingDialog = $ref(false)
let showChangeLastPracticeIndexDialog = $ref(false)
let showPracticeWordListDialog = $ref(false)

type StudyDayRow = Statistics & { dictName: string }

let showStudyDayDialog = $ref(false)
let selectedStudyDateKey = $ref('')
let studyDayRecords = $ref<StudyDayRow[]>([])

const allWordStatistics = $computed(() => store.word.bookList.flatMap(book => book.statistics ?? []))

const cacheSpendMs = $computed(() => practiceData.statStoreData?.spend ?? 0)

const todayDateKey = $computed(() => dayjs().format('YYYY-MM-DD'))

/**
 * 缓存记录中每一天对应的学习毫秒数 Map<'YYYY-MM-DD', spendMs>
 * 有 segments 时按片段精确分组，否则退回到 startDate + spend 整体归一天
 */
const cacheDaySpendMap = $computed((): Map<string, number> => {
  const st = practiceData.statStoreData
  const map = new Map<string, number>()
  if (!st?.spend) return map
  if (Array.isArray(st.segments) && st.segments.length > 0) {
    for (const [segStart, segEnd] of st.segments) {
      const key = dayjs(segStart).format('YYYY-MM-DD')
      map.set(key, (map.get(key) ?? 0) + (segEnd - segStart))
    }
  } else {
    // 老数据 / 无 segments：全部归到 startDate 那天
    map.set(dayjs(st.startDate).format('YYYY-MM-DD'), st.spend)
  }
  return map
})

const todayCacheMs = $computed(() => cacheDaySpendMap.get(todayDateKey) ?? 0)

const calendarHighlightDates = $computed(() => {
  const set = new Set<string>()
  for (const s of allWordStatistics) {
    set.add(dayjs(s.startDate).format('YYYY-MM-DD'))
  }
  // 把缓存记录中所有出现过的天都高亮（支持跨天）
  for (const key of cacheDaySpendMap.keys()) {
    set.add(key)
  }
  return [...set]
})

/** 已落库统计总毫秒（全 bookList） */
const persistedTotalMs = $computed(() => total(allWordStatistics, 'spend'))

const totalSpend = $computed(() => {
  const sum = persistedTotalMs + cacheSpendMs
  if (!sum) return 0
  return msToHourMinute(sum)
})

const todayTotalSpend = $computed(() => {
  const todayPersistedMs = total(
    allWordStatistics.filter(v => dayjs(v.startDate).isSame(dayjs(), 'day')),
    'spend'
  )
  const sum = todayPersistedMs + todayCacheMs
  if (!sum) return 0
  return msToHourMinute(sum)
})

const totalDay = $computed(() => {
  const set = new Set(allWordStatistics.map(v => dayjs(v.startDate).format('YYYY-MM-DD')))
  // 把缓存记录中所有出现过的天都计入（支持跨天）
  for (const key of cacheDaySpendMap.keys()) {
    set.add(key)
  }
  return set.size
})

const studyDayDialogTitle = $computed(() =>
  selectedStudyDateKey ? `${dayjs(selectedStudyDateKey).format('YYYY-MM-DD')} Study records` : ''
)

function isStudyDayKeyToday(dateKey: string) {
  return dateKey === dayjs().format('YYYY-MM-DD')
}

function onSelectCalendarDate(dateKey: string) {
  selectedStudyDateKey = dateKey
  const rows: StudyDayRow[] = []
  for (const book of store.word.bookList) {
    for (const stat of book.statistics ?? []) {
      if (dayjs(stat.startDate).format('YYYY-MM-DD') === dateKey) {
        rows.push({ ...stat, dictName: book.name })
      }
    }
  }
  const st = practiceData.statStoreData
  // 缓存记录跨天时，只要该天在 cacheDaySpendMap 中有记录就展示
  if (st?.spend && cacheDaySpendMap.has(dateKey)) {
    const daySpend = cacheDaySpendMap.get(dateKey)!
    const cacheKeys = [...cacheDaySpendMap.keys()]
    const keyIdx = cacheKeys.indexOf(dateKey)
    const isMultiDay = cacheKeys.length > 1
    // 推算该天在整次练习中的角色（练习未结束，最后一天标为"学习中"而非"学习结束"）
    let sessionRole: StudyDayRow['sessionRole']
    if (!isMultiDay) {
      sessionRole = 'single'
    } else if (keyIdx === 0) {
      sessionRole = 'start'
    } else if (keyIdx === cacheKeys.length - 1) {
      sessionRole = 'middle' // 最后一天仍在进行中，用 middle 表示
    } else {
      sessionRole = 'middle'
    }
    rows.push({
      ...st,
      spend: daySpend,
      new: st.newWordNumber,
      review: st.reviewWordNumber,
      dictName: store.sdict.name,
      sessionRole,
    })
  }
  if (!rows.length) return Toast.info('No study records')
  studyDayRecords = rows
  showStudyDayDialog = true
}

async function goDictDetail(val: DictResource) {
  if (!val.id) return nav('dict-list')
  runtimeStore.editDict = getDefaultDict(val)
  nav('/dict', {})
}

let isManageDict = $ref(false)
let selectIds = $ref([])

async function handleBatchDel() {
  selectIds.forEach(id => {
    let r = store.word.bookList.findIndex(v => v.id === id)
    if (r !== -1) {
      if (store.word.studyIndex === r) {
        store.word.studyIndex = -1
      }
      if (store.word.studyIndex > r) {
        store.word.studyIndex--
      }
      store.word.bookList.splice(r, 1)
    }
  })
  selectIds = []
  Toast.success('Deleted successfully!')
}

function toggleSelect(item) {
  let rIndex = selectIds.findIndex(v => v === item.id)
  if (rIndex > -1) {
    selectIds.splice(rIndex, 1)
  } else {
    selectIds.push(item.id)
  }
}

const progressTextLeft = $computed(() => {
  if (store.sdict.complete) return 'Completed, now in the full review stage'
  return 'Progress: ' + store.currentStudyProgress + '% learned'
})

function check(cb: Function) {
  if (!store.sdict.id) {
    Toast.warning('Please select a dictionary first')
  } else {
    runtimeStore.editDict = getDefaultDict(store.sdict)
    cb()
  }
}

async function savePracticeSetting() {
  await resetCacheData()
  await store.changeDict(runtimeStore.editDict)
  refreshStudyTask()
  Toast.success('Updated successfully')
}

async function onShufflePracticeSettingOk(setting: ShufflePracticeSetting) {
  await dataSync.saveDictState()
  await resetCacheData()
  settingStore.wordPracticeMode = editingWordPracticeMode

  window.umami?.track('startStudyWord', {
    name: store.sdict.name,
    index: store.sdict.lastLearnIndex,
    perDayStudyNumber: store.sdict.perDayStudyNumber,
    custom: store.sdict.custom,
    complete: store.sdict.complete,
    wordPracticeMode: settingStore.wordPracticeMode,
  })

  const result = getShufflePracticeWords(store.sdict.words, setting, store.getIgnoreWordsSet())
  practiceData.taskWords.review = result.words
  nav(
    WordPracticeModeUrlMap[editingWordPracticeMode] + '/' + store.sdict.id,
    {},
    {
      ...practiceData,
      total: result.words.length,
      shuffleRange: result.range,
    }
  )
}

async function saveLastPracticeIndex(e) {
  runtimeStore.editDict.lastLearnIndex = e
  showChangeLastPracticeIndexDialog = false
  await resetCacheData()
  await store.changeDict(runtimeStore.editDict)
  refreshStudyTask()
  Toast.success('Updated successfully')
}

const { data: recommendDictList, isFetching } = useFetch(resourceWrap(DICT_LIST.WORD.RECOMMENDED)).json()

const systemPracticeText = $computed(() => {
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) {
    return 'Start Learning'
  } else if (settingStore.wordPracticeMode === WordPracticeMode.Custom) {
    return isSaveData ? 'Continue Custom Practice' : 'Start Custom Practice'
  } else {
    return isSaveData
      ? 'Continue ' + WordPracticeModeNameMap[settingStore.wordPracticeMode]
      : 'Start ' + WordPracticeModeNameMap[settingStore.wordPracticeMode]
  }
})

let isOldHost = $ref(false)
onMounted(() => {
  isOldHost = window.location.host === Old_Host
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onvisibilitychange)
})
</script>

<template>
  <BasePage>
    <div class="my-100 text-4xl font-bold text-red" v-if="isOldHost">
      New domain is now active
      <a class="mr-4" :href="`${Origin}/words?from_old_site=1`">{{ Origin }}</a
      >The current 2study.top domain will stop working on July 3
    </div>

    <div class="card flex flex-col md:flex-row gap-4">
      <div class="flex-1 flex flex-col justify-between">
        <div class="flex gap-3">
          <div class="p-1 center rounded-full bg-white">
            <IconFluentBookNumber20Filled class="text-xl color-link" />
          </div>
          <div @click="goDictDetail(store.sdict)" class="text-2xl font-bold cursor-pointer">
            {{ store.sdict.name || $t('no_dict_selected') }}
          </div>
        </div>

        <template v-if="store.sdict.id">
          <div class="mt-4 space-y-2">
            <div class="text-sm flex justify-between">
              <span v-opacity="store.sdict.id && store.sdict.lastLearnIndex < store.sdict.length">
                {{ $t('estimated_completion') }}：{{
                  _getAccomplishDate(
                    store.sdict.words.length - store.sdict.lastLearnIndex,
                    store.sdict.perDayStudyNumber
                  )
                }}
              </span>
            </div>
            <Progress size="large" :percentage="store.currentStudyProgress" :show-text="false"></Progress>

            <div class="text-sm flex justify-between">
              <span>{{ progressTextLeft }}</span>
              <span> {{ store.sdict?.lastLearnIndex }} / {{ store.sdict.length }} words</span>
            </div>
          </div>
          <div class="flex items-center mt-4 gap-4">
            <BaseButton type="info" size="small" @click="router.push('/dict-list')">
              <div class="center gap-1">
                <IconFluentArrowSwap20Regular />
                <span>{{ $t('select_dict') }}</span>
              </div>
            </BaseButton>
            <PopConfirm
              :disabled="!isSaveData"
              title="You have an unfinished study task. Changing this will regenerate the task. Continue?"
              @confirm="check(() => (showChangeLastPracticeIndexDialog = true))"
            >
              <BaseButton type="info" size="small" v-if="store.sdict.id">
                <div class="center gap-1">
                  <IconFluentSlideTextTitleEdit20Regular />
                  <span>{{ $t('change_progress') }}</span>
                </div>
              </BaseButton>
            </PopConfirm>
          </div>
        </template>

        <div class="flex items-center gap-4 mt-2 flex-1" v-else>
          <div class="title">{{ $t('select_dict_to_start') }}</div>
          <BaseButton id="step1" type="primary" size="large" @click="router.push('/dict-list')">
            <div class="center gap-1">
              <IconFluentAdd16Regular />
              <span>{{ $t('select_dict') }}</span>
            </div>
          </BaseButton>
        </div>
      </div>
      <div class="flex-1 mt-4 md:mt-0" :class="!store.sdict.id && 'opacity-30 cursor-not-allowed'">
        <div class="flex justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 center rounded-full bg-white">
              <IconFluentStar20Filled class="text-lg color-amber" />
            </div>
            <div class="text-xl font-bold">
              {{ isSaveData ? $t('last_task') : $t('today_task') }}
            </div>
            <span class="color-link cursor-pointer" v-if="store.sdict.id" @click="showPracticeWordListDialog = true">{{
              $t('word_list')
            }}</span>
            <!--            <span class="color-link cursor-pointer ml-2" @click="nav('/practice-flow-editor', {})">流程编排</span>-->
          </div>
          <div class="flex gap-1 items-center" v-if="store.sdict.id">
            {{ $t('daily_goal') }}
            <div style="color: #ac6ed1" class="bg-third px-2 h-10 flex center text-2xl rounded">
              {{ store.sdict.id ? store.sdict.perDayStudyNumber : 0 }}
            </div>
            {{ $t('words_count') }}
            <PopConfirm
              :disabled="!isSaveData"
              title="You have an unfinished study task. Changing this will regenerate the task. Continue?"
              @confirm="check(() => (showPracticeSettingDialog = true))"
            >
              <BaseButton type="info" size="small">{{ $t('change') }}</BaseButton>
            </PopConfirm>
          </div>
        </div>
        <div class="flex mt-4 justify-between">
          <div class="stat">
            <div class="num">{{ practiceData?.taskWords?.new?.length }}</div>
            <div class="txt">{{ $t('new_words') }}</div>
          </div>
          <div class="stat">
            <div class="num flex center">
              {{ practiceData?.taskWords?.review?.length }}
              <span class="text-base color-reverse-black" v-if="!practiceData?.taskWords?.review?.length"
                >(No words due)</span
              >
            </div>
            <div class="txt flex center gap-1">
              <span>{{ $t('review') }}</span>
              <Tooltip>
                <IconFluentQuestionCircle20Regular class="mt-.5" width="18" />
                <template #reference>
                  <div class="whitespace-pre-wrap">{{ reviewWordTip }}</div>
                </template>
              </Tooltip>
            </div>
            <div class="center gap-2 mt-1 text-sm" v-if="!isSaveData && dueReviewCount === 0">
              <span>Add random review</span>
              <Switch :model-value="settingStore.autoAddRandomReviewWhenNoDue" @change="toggleAutoAddRandomReview" />
            </div>
          </div>
        </div>
        <div class="flex items-end mt-4 gap-4 btn-no-margin">
          <OptionButton
            :class="settingStore.wordPracticeMode !== WordPracticeMode.Free ? 'flex-1 orange-btn' : 'primary-btn'"
          >
            <BaseButton
              size="large"
              :type="settingStore.wordPracticeMode !== WordPracticeMode.Free ? 'orange' : 'primary'"
              :disabled="!store.sdict.id"
              :loading="loading"
              @click="systemPractice"
            >
              <div class="flex items-center gap-2">
                <span class="line-height-[2]">{{ systemPracticeText }}</span>
                <IconFluentArrowCircleRight16Regular class="text-xl" />
              </div>
            </BaseButton>
            <template #options>
              <BaseButton
                class="w-full"
                v-if="
                  settingStore.wordPracticeMode !== WordPracticeMode.System &&
                  settingStore.wordPracticeMode !== WordPracticeMode.Free
                "
                @click="startPractice(WordPracticeMode.System, true)"
              >
                {{ $t('smart_learning') }}
              </BaseButton>

              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.Review"
                :disabled="!practiceData?.taskWords?.review?.length"
                @click="startPractice(WordPracticeMode.Review, true)"
              >
                {{ $t('review') }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.Shuffle"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.Shuffle, true)"
              >
                {{ $t('random_review') }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.ReviewWordsTest"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.ReviewWordsTest, true)"
              >
                {{ $t('words') }}{{ $t('test') }}
              </BaseButton>
              <BaseButton
                class="w-full"
                v-if="settingStore.wordPracticeMode !== WordPracticeMode.ShuffleWordsTest"
                :disabled="store.sdict.lastLearnIndex < 10 && !store.sdict.complete"
                @click="startPractice(WordPracticeMode.ShuffleWordsTest, true)"
              >
                {{ $t('random_words_test') }}
              </BaseButton>
            </template>
          </OptionButton>

          <BaseButton
            :class="settingStore.wordPracticeMode === WordPracticeMode.Free ? 'flex-1' : ''"
            :type="settingStore.wordPracticeMode === WordPracticeMode.Free ? 'orange' : 'primary'"
            size="large"
            :loading="loading"
            @click="freePractice()"
          >
            <div class="flex items-center gap-2">
              <span class="line-height-[2]">
                {{
                  settingStore.wordPracticeMode === WordPracticeMode.Free && isSaveData
                    ? $t('continue_free_practice')
                    : $t('free_practice')
                }}
              </span>
              <IconStreamlineColorPenDrawFlat class="text-xl" />
            </div>
          </BaseButton>
        </div>
      </div>
    </div>

    <div class="card flex flex-col md:flex-row gap-4 xl:gap-20 p-4 md:p-6">
      <div class="flex-1 flex flex-col gap-3 min-w-0">
        <div class="title">Statistics</div>
        <div class="flex gap-3 items-center w-full">
          <div class="stat2">
            <div class="num">{{ todayTotalSpend }}</div>
            <div class="txt">{{ $t('today_study_time') }}</div>
          </div>
          <div class="stat2">
            <div class="num">{{ totalDay }}</div>
            <div class="txt">{{ $t('total_study_days') }}</div>
          </div>
          <div class="stat2">
            <div class="num">{{ totalSpend }}</div>
            <div class="txt">{{ $t('total_study_time') }}</div>
          </div>
        </div>
      </div>
      <div class="shrink-0 flex items-center">
        <Calendar
          :highlighted-dates="calendarHighlightDates"
          @select-date="onSelectCalendarDate"
          :weekHeaderTitle="$t('this_week_record')"
        >
        </Calendar>
      </div>
    </div>

    <div class="card flex flex-col">
      <div class="flex justify-between">
        <div class="title">{{ $t('my_dictionaries') }}</div>
        <div class="flex gap-4 items-center">
          <PopConfirm title="Delete all selected dictionaries?" @confirm="handleBatchDel" v-if="selectIds.length">
            <BaseIcon class="del" :title="$t('delete')">
              <DeleteIcon />
            </BaseIcon>
          </PopConfirm>

          <div
            class="color-link cursor-pointer"
            v-if="store.word.bookList.length > 3"
            @click="
              () => {
                isManageDict = !isManageDict
                selectIds = []
              }
            "
          >
            {{ isManageDict ? $t('cancel') : $t('manage_dict') }}
          </div>
          <div class="color-link cursor-pointer" @click="nav('/dict', { isAdd: true })">
            {{ $t('create_personal_dict') }}
          </div>
        </div>
      </div>
      <div class="flex gap-4 flex-wrap mt-4">
        <Book
          :is-add="false"
          quantifier=" words"
          :item="item"
          :checked="selectIds.includes(item.id)"
          @check="() => toggleSelect(item)"
          :show-checkbox="isManageDict && j >= 3"
          v-for="(item, j) in store.word.bookList"
          @click="goDictDetail(item)"
        />
        <Book :is-add="true" @click="router.push('/dict-list')" />
      </div>
    </div>

    <div class="card flex flex-col overflow-hidden" v-loading="isFetching">
      <div class="flex justify-between">
        <div class="title">{{ $t('recommend') }}</div>
        <div class="flex gap-4 items-center">
          <div class="color-link cursor-pointer" @click="router.push('/dict-list')">{{ $t('more') }}</div>
        </div>
      </div>

      <div class="flex gap-4 flex-wrap mt-4 min-h-50">
        <Book
          :is-add="false"
          quantifier=" words"
          :item="item as any"
          v-for="(item, j) in recommendDictList"
          @click="goDictDetail(item as any)"
        />
      </div>
    </div>
  </BasePage>

  <PracticeSettingDialog
    :show-left-option="false"
    v-model="showPracticeSettingDialog"
    :onConfirm="savePracticeSetting"
  />

  <ChangeLastPracticeIndexDialog v-model="showChangeLastPracticeIndexDialog" @ok="saveLastPracticeIndex" />

  <PracticeWordListDialog :data="practiceData?.taskWords" v-model="showPracticeWordListDialog" />

  <ShufflePracticeSettingDialog
    v-model="showShufflePracticeSettingDialog"
    :onConfirm="onShufflePracticeSettingOk"
    :wordPracticeMode="editingWordPracticeMode"
  />

  <Dialog v-model="showStudyDayDialog" :title="studyDayDialogTitle" :footer="false" :padding="true">
    <div
      v-if="!studyDayRecords.length && !(isStudyDayKeyToday(selectedStudyDateKey) && todayCacheMs > 0)"
      class="text-gray-500 py-6 text-center"
    >
      No study records for this day
    </div>
    <ul v-if="studyDayRecords.length" class="study-day-list max-h-70vh overflow-y-auto space-y-3">
      <li v-for="(row, idx) in studyDayRecords" :key="idx" class="border-b border-gray-200 pb-3 last:border-0">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ row.dictName }}</span>
          <span
            v-if="row.sessionRole && row.sessionRole !== 'single'"
            class="text-xs px-1.5 py-0.5 rounded-full"
            :class="{
              'bg-green-100 text-green-700': row.sessionRole === 'start',
              'bg-blue-100 text-blue-700': row.sessionRole === 'middle',
              'bg-orange-100 text-orange-700': row.sessionRole === 'end',
            }"
          >
            {{ { start: 'Session start', middle: 'In progress', end: 'Session end' }[row.sessionRole] }}
          </span>
        </div>
        <div class="text-sm text-gray-600 mt-1">
          Duration {{ msToHourMinute(row.spend) }} · New {{ row.new }} · Review {{ row.review }} · Mistakes {{ row.wrong }}
          <template v-if="row.total"> · Total {{ row.total }} words</template>
        </div>
      </li>
    </ul>
  </Dialog>
</template>

<style scoped lang="scss">
.stat {
  @apply w-49% box-border flex flex-col items-center justify-center rounded-xl p-2 bg-[var(--bg-history)];
  border: 1px solid gainsboro;

  .num {
    @apply color-[#409eff] text-4xl font-bold;
  }

  .txt {
    @apply color-gray-500;
  }
}

.stat2 {
  @extend .stat;
  @apply py-4 flex-1;
  width: unset;

  .num {
    @apply text-2xl break-keep;
  }
}
</style>
