<script setup lang="ts">
import { onMounted } from 'vue'
import { BaseButton, BasePage, Toast, VolumeIcon } from '@/base'
import { useRoute, useRouter } from 'vue-router'
import { useBaseStore } from '@/core/stores/base.ts'
import type { Dict, Question, TaskWords, Word } from '@/core/types/types.ts'
import { _getDictDataByUrl, shuffle, useNav } from '@/core/utils'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import { usePlayBeep, usePlayCorrect, usePlayWordAudio } from '@/core/hooks/sound.ts'
import { useEvents } from '@/core/utils/eventBus'
import { useStartKeyboardEventListener } from '@/core/hooks/event.ts'
import { ShortcutKey } from '@/core/types/enum'
import { useSettingStore } from '@/core/stores/setting.ts'
import { buildQuestion } from '@/core/utils/word-test'
import TranslationList from '@/components/word/TranslationList.vue'

const route = useRoute()
const router = useRouter()
const base = useBaseStore()
const runtimeStore = useRuntimeStore()
const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playWordAudio = usePlayWordAudio()

let loading = $ref(false)
let dict = $ref<Dict>()
let questions = $ref<Question[]>([])
let index = $ref(0)
let pageNo = $ref(0)
let pageSize = $ref(100)
let allWords = []
let testWords = []
let total = $computed(() => {
  return (pageNo + 1) * pageSize
})
let no = $computed(() => {
  return pageNo * pageSize + index + 1
})

async function init() {
  let dictId: any = route.params.id
  let d = base.word.bookList.find(v => v.id === dictId)
  if (!d) d = base.sdict
  if (!d?.id) return router.push('/words')
  dict = d
  if (!d.words.length && runtimeStore.editDict?.id === d.id) {
    loading = true
    let r = await _getDictDataByUrl(runtimeStore.editDict)
    d = r
    loading = false
  }
  if (!dict.words.length) {
    return Toast.warning('没有单词可测试！')
  }
  if (runtimeStore.routeData.taskWords) {
    let currentStudy: TaskWords = runtimeStore.routeData.taskWords
    if (currentStudy.review.length) {
      testWords = runtimeStore.routeData.taskWords.review
    }
  }
  if (!testWords.length) {
    testWords = shuffle(dict.words)
  }
  allWords = shuffle(dict.words)
  questions = testWords.slice(pageNo * pageSize, (pageNo + 1) * pageSize).map(w => buildQuestion(w, allWords))
  console.log('questions', questions)
  index = 0

  Toast.info('可以按快捷键进行选择,例如按快捷键[' + aShortcutKey + ']选择A', { duration: 3000 })
}

let submitted = $ref(false)
let selectedIndex = $ref(-1)
function select(i: number) {
  let q = questions[index]
  if (!q || submitted) return
  selectedIndex = i
  submitted = true
  if (i === q.correctIndex) {
    playCorrect()
  } else {
    playBeep()
    let temp = q.candidates[q.correctIndex].word.word.toLowerCase()
    if (!base.wrong.words.find((v: Word) => v.word.toLowerCase() === temp)) {
      base.wrong.words.push(q.candidates[q.correctIndex].word)
      base.wrong.length = base.wrong.words.length
    }
  }
}

const { nav } = useNav()

function next() {
  submitted = false
  selectedIndex = -1
  if (no >= testWords.length) {
    nav('/words')
  }
  if (no < total) index++
  else {
    pageNo++
    index = 0
    questions = testWords.slice(pageNo * pageSize, (pageNo + 1) * pageSize).map(w => buildQuestion(w, allWords))
  }
}

function end() {
  router.back()
}

useStartKeyboardEventListener()

useEvents([
  [ShortcutKey.ChooseA, () => select(0)],
  [ShortcutKey.ChooseB, () => select(1)],
  [ShortcutKey.ChooseC, () => select(2)],
  [ShortcutKey.ChooseD, () => select(3)],
  [ShortcutKey.Next, () => next()],
])

const settingStore = useSettingStore()

let aShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseA]
let bShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseB]
let cShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseC]
let dShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseD]

let nextShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.Next]

onMounted(init)
</script>

<template>
  <BasePage>
    <div class="card flex flex-col text-xl">
      <div class="flex items-center justify-between">
        <div class="page-title">测试：{{ dict?.name }}</div>
        <div class="text-base">{{ no }} / {{ Math.min(total, testWords.length) }}</div>
      </div>
      <div class="line my-2"></div>

      <div v-if="questions.length" class="flex flex-col gap-4">
        <div class="text-4xl en-article-family flex items-center gap-2">
          <span>{{ questions[index].candidates[questions[index].correctIndex].word.word }}</span>
          <VolumeIcon :simple="true" :title="'发音'" :cb="() => playWordAudio(questions[index].candidates[questions[index].correctIndex].word.word)" />
        </div>
        <div class="grid gap-6">
          <div
            v-for="(opt, i) in questions[index].candidates"
            :key="i"
            class="option border rounded cursor-pointer"
            :class="{
              'text-green-600': submitted && i === questions[index].correctIndex,
              'text-red-600':
                submitted &&
                i === selectedIndex &&
                i !== questions[index].correctIndex,
            }"
            @click="select(i)"
          >
            <span class="">
              <span class="italic">{{ ['A', 'B', 'C', 'D'][i] }}</span>
              <span class="mx-2">[{{ [aShortcutKey, bShortcutKey, cShortcutKey, dShortcutKey][i] }}]</span>
              <TranslationList :word="opt.word" :show-full="false"></TranslationList>
            </span>
            <div class="" v-opacity="submitted">{{ opt.word.word }}</div>
          </div>
        </div>

        <div class="mt-6 flex">
          <BaseButton type="primary" @click="next">继续测试[{{ nextShortcutKey }}]</BaseButton>
          <BaseButton type="info" @click="end">结束</BaseButton>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped>
.option:hover {
  background: var(--color-second);
}
.option {
  min-height: 80px;
}
</style>
