<script setup lang="ts">
import { BaseButton, InputNumber, Slider, Toast } from '@/base'
import { computed, defineAsyncComponent, watch } from 'vue'
import { useBaseStore } from '@/core/stores/base.ts'
import { WordPracticeModeNameMap } from '@/core/config/env'
import { useSettingStore } from '@/core/stores/setting.ts'
import { getShufflePracticeWords, toShufflePracticeRange, type ShufflePracticeSetting } from '@/core/utils'
const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

const MIN_RANGE_WORD_COUNT = 5
const MIN_RANGE_GAP = MIN_RANGE_WORD_COUNT - 1

const props = defineProps<{
  wordPracticeMode: number
  onConfirm?: (setting: ShufflePracticeSetting) => Promise<void | boolean>
}>()

let wordPracticeMode = $computed(() => WordPracticeModeNameMap[props.wordPracticeMode])

const store = useBaseStore()
const settingStore = useSettingStore()
const model = defineModel()

let num = $ref(0)
let startNo = $ref(1)
let endNo = $ref(0)
let showRangeInput = $ref(false)
let showInsufficientDialog = $ref(false)
let requestedCount = $ref(0)
let availableCount = $ref(0)

const wordCount = $computed(() => store.sdict.words.length)
const progressNo = $computed(() => Math.min(Math.max(Number(store.sdict.lastLearnIndex) || 0, 0), wordCount))
const displayRange = $computed(() => {
  const end = Math.min(Math.max(Math.floor(Number(endNo) || 0), 0), wordCount)
  const start = end > 0 ? Math.min(Math.max(Math.floor(Number(startNo) || 1), 1), end) : 0
  return { start, end }
})
const rangeWordCount = $computed(() => (displayRange.end > 0 ? displayRange.end - displayRange.start : 0))
const sliderMinGap = $computed(() =>
  wordCount >= MIN_RANGE_WORD_COUNT && rangeWordCount >= MIN_RANGE_WORD_COUNT ? MIN_RANGE_GAP : 0
)
const rangeModel = computed<[number, number]>({
  get() {
    return [displayRange.start || 1, displayRange.end || 1]
  },
  set(value) {
    setRange(value[0], value[1])
  },
})

function getDefaultTotal(total: number) {
  if (total <= 0) return 0
  return Math.min(Math.max(Math.floor(total / 3), 1), 50, total)
}

function setDefaultRange() {
  startNo = progressNo > 0 ? 1 : wordCount > 0 ? 1 : 0
  endNo = progressNo
  num = getDefaultTotal(rangeWordCount)
}

function setRawRange(start: number, end: number) {
  if (!wordCount) {
    startNo = 0
    endNo = 0
    syncTotalWithRange()
    return
  }
  startNo = Math.min(Math.max(Math.floor(Number(start) || 1), 1), wordCount)
  endNo = Math.min(Math.max(Math.floor(Number(end) || 1), 1), wordCount)
  syncTotalWithRange()
}

function setRange(start: number, end: number, target?: 'start' | 'end') {
  if (!wordCount) {
    setRawRange(0, 0)
    return
  }

  let nextStart = Math.min(Math.max(Math.floor(Number(start) || 1), 1), wordCount)
  let nextEnd = Math.min(Math.max(Math.floor(Number(end) || 1), 1), wordCount)
  const gap = wordCount >= MIN_RANGE_WORD_COUNT ? MIN_RANGE_GAP : Math.max(wordCount - 1, 0)

  if (nextStart > nextEnd) {
    if (target === 'start') {
      nextStart = nextEnd
    } else if (target === 'end') {
      nextEnd = nextStart
    } else {
      ;[nextStart, nextEnd] = [nextEnd, nextStart]
    }
  }

  if (nextEnd - nextStart < gap) {
    if (target === 'start') {
      nextStart = nextEnd - gap
    } else {
      nextEnd = nextStart + gap
    }
  }

  if (nextStart < 1) {
    nextStart = 1
    nextEnd = Math.min(wordCount, nextStart + gap)
  }
  if (nextEnd > wordCount) {
    nextEnd = wordCount
    nextStart = Math.max(1, nextEnd - gap)
  }

  startNo = nextStart
  endNo = nextEnd
  syncTotalWithRange()
}

function syncTotalWithRange() {
  if (rangeWordCount <= 0) {
    num = 0
    return
  }
  if (!num) {
    num = getDefaultTotal(rangeWordCount)
  } else if (num > rangeWordCount) {
    num = rangeWordCount
  } else if (num < 1) {
    num = 1
  }
}

function applyRecentRange(size: number) {
  if (progressNo <= 0) {
    setRawRange(wordCount > 0 ? 1 : 0, 0)
    return
  }
  setRange(Math.max(1, progressNo - size + 1), progressNo)
}

function getSetting(total = num): ShufflePracticeSetting {
  return {
    total: Math.max(0, Math.floor(Number(total) || 0)),
    range: toShufflePracticeRange(displayRange.start, displayRange.end, wordCount),
  }
}

function getSelection(total = num) {
  const ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
  return getShufflePracticeWords(store.sdict.words, getSetting(total), ignoreSet)
}

async function submit(setting: ShufflePracticeSetting) {
  const res = await props.onConfirm?.(setting)
  if (res === false) return false
  model.value = false
  return true
}

async function confirm() {
  syncTotalWithRange()
  if (rangeWordCount < MIN_RANGE_WORD_COUNT) {
    Toast.warning('随机区间至少需要5个单词')
    return false
  }
  if (!num) {
    Toast.warning('请设置随机数量')
    return false
  }

  const result = getSelection()
  if (!result.available) {
    Toast.warning('当前区间筛选后没有可用单词，请调整区间或忽略规则')
    return false
  }

  if (result.available < result.total) {
    requestedCount = result.total
    availableCount = result.available
    showInsufficientDialog = true
    return false
  }

  return props.onConfirm?.(getSetting(result.total))
}

async function continueWithAvailable() {
  return submit(getSetting(availableCount))
}

watch(
  () => model.value,
  n => {
    if (n) {
      showRangeInput = false
      showInsufficientDialog = false
      setDefaultRange()
    }
  }
)

watch(
  () => rangeWordCount,
  () => syncTotalWithRange()
)
</script>

<template>
  <Dialog v-model="model" :title="wordPracticeMode + '设置'" :footer="true" :padding="true" :onConfirm="confirm">
    <div class="w-120 color-main">
      <div class="center items-end mb-4">
        从<span class="font-bold mx-2">{{ store.sdict.name }}</span
        >的 <span class="font-bold mx-2">[{{ startNo }} - {{ endNo }}]</span>中<span>{{ wordPracticeMode }}</span>
        <span class="target-number mx-2">{{ num }}</span
        >个单词
      </div>

      <div class="space-y-4">
        <div class="flex items-start gap-space">
          <span class="shrink-0 w-20">随机数量：</span>
          <Slider
            v-model="num"
            show-input
            show-text
            class="mt-1"
            :min="rangeWordCount ? 1 : 0"
            :max="rangeWordCount"
            :step="1"
          />
        </div>

        <div class="flex items-start gap-space">
          <span class="shrink-0 w-20">随机范围：</span>
          <div class="flex-1">
            <Slider
              v-model="rangeModel"
              range
              draggable-track
              show-text
              :min="1"
              :max="wordCount || 1"
              :step="1"
              :min-gap="sliderMinGap"
            />
            <div class="text-sm mt-1" :class="rangeWordCount < MIN_RANGE_WORD_COUNT ? 'text-red-500' : 'text-gray-500'">
              第 {{ displayRange.start || 0 }} 到 {{ displayRange.end || 0 }} 个，当前区间 {{ rangeWordCount }} 个单词
            </div>
          </div>
          <BaseButton type="info" @click="showRangeInput = !showRangeInput">输入</BaseButton>
        </div>

        <div class="flex items-center gap-space pl-24" v-if="showRangeInput">
          <span>第</span>
          <InputNumber
            :min="wordCount ? 1 : 0"
            :max="wordCount"
            :model-value="startNo"
            @update:model-value="value => setRange(Number(value), endNo, 'start')"
          />
          <span>到</span>
          <InputNumber
            :min="wordCount ? 1 : 0"
            :max="wordCount"
            :model-value="endNo"
            @update:model-value="value => setRange(startNo, Number(value), 'end')"
          />
          <span>个</span>
        </div>

        <div class="flex items-center gap-space">
          <span class="shrink-0 w-20">快捷选择：</span>
          <BaseButton type="info" @click="applyRecentRange(500)">最近500个</BaseButton>
          <BaseButton type="info" @click="applyRecentRange(300)">最近300个</BaseButton>
          <BaseButton type="info" @click="applyRecentRange(100)">最近100个</BaseButton>
        </div>
      </div>
    </div>
  </Dialog>

  <Dialog
    v-model="showInsufficientDialog"
    title="可用单词不足"
    :footer="true"
    :padding="true"
    confirm-button-text="继续"
    cancel-button-text="取消"
    :onConfirm="continueWithAvailable"
  >
    <div class="w-90 color-main py-2">
      当前范围筛选后只有
      <span class="font-bold target-number">{{ availableCount }}</span>
      个可用单词，少于你设置的
      <span class="font-bold target-number">{{ requestedCount }}</span>
      个。继续后将以当前可用数量开始，取消后可重新修改。
    </div>
  </Dialog>
</template>

<style scoped lang="scss"></style>
