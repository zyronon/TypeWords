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
    Toast.warning('The random range needs at least 5 words')
    return false
  }
  if (!num) {
    Toast.warning('Please set the random count')
    return false
  }

  const result = getSelection()
  if (!result.available) {
    Toast.warning('No words available in the current range after filtering. Adjust the range or the ignore rules')
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
  <Dialog v-model="model" :title="wordPracticeMode + ' Settings'" :footer="true" :padding="true" :onConfirm="confirm">
    <div class="w-120 color-main">
      <div class="center items-end mb-4">
        From<span class="font-bold mx-2">{{ store.sdict.name }}</span
        > <span class="font-bold mx-2">[{{ startNo }} - {{ endNo }}]</span>, <span>{{ wordPracticeMode }}</span>
        <span class="target-number mx-2">{{ num }}</span
        >words
      </div>

      <div class="space-y-4">
        <div class="flex items-start gap-space">
          <span class="shrink-0 w-20">Count:</span>
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
          <span class="shrink-0 w-20">Range:</span>
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
              Words {{ displayRange.start || 0 }} to {{ displayRange.end || 0 }}, {{ rangeWordCount }} words in the current range
            </div>
          </div>
          <BaseButton type="info" @click="showRangeInput = !showRangeInput">Input</BaseButton>
        </div>

        <div class="flex items-center gap-space pl-24" v-if="showRangeInput">
          <span>From</span>
          <InputNumber
            :min="wordCount ? 1 : 0"
            :max="wordCount"
            :model-value="startNo"
            @update:model-value="value => setRange(Number(value), endNo, 'start')"
          />
          <span>to</span>
          <InputNumber
            :min="wordCount ? 1 : 0"
            :max="wordCount"
            :model-value="endNo"
            @update:model-value="value => setRange(startNo, Number(value), 'end')"
          />
        </div>

        <div class="flex items-center gap-space">
          <span class="shrink-0 w-20">Quick pick:</span>
          <BaseButton type="info" @click="applyRecentRange(500)">Last 500</BaseButton>
          <BaseButton type="info" @click="applyRecentRange(300)">Last 300</BaseButton>
          <BaseButton type="info" @click="applyRecentRange(100)">Last 100</BaseButton>
        </div>
      </div>
    </div>
  </Dialog>

  <Dialog
    v-model="showInsufficientDialog"
    title="Not Enough Words"
    :footer="true"
    :padding="true"
    confirm-button-text="Continue"
    cancel-button-text="Cancel"
    :onConfirm="continueWithAvailable"
  >
    <div class="w-90 color-main py-2">
      After filtering, the current range has only
      <span class="font-bold target-number">{{ availableCount }}</span>
      available words, fewer than the
      <span class="font-bold target-number">{{ requestedCount }}</span>
      you set. Continue to start with the available words, or cancel to adjust.
    </div>
  </Dialog>
</template>

<style scoped lang="scss"></style>
