<script setup lang="ts">
import { onMounted, onUnmounted, toRaw } from 'vue'
import { BaseButton, BaseIcon, BasePage, Toast, VolumeIcon } from '@/base'
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
import { useWordOptions } from '@/core/hooks/dict.ts'
import { closeWordCollectPicker, openWordCollectPicker } from '@/core/hooks/useWordCollectPicker.ts'

const route = useRoute()
const router = useRouter()
const base = useBaseStore()
const runtimeStore = useRuntimeStore()
const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playWordAudio = usePlayWordAudio()
const { isWordCollect, toggleWordCollect } = useWordOptions()

let loading = $ref(false)
let dict = $ref<Dict>()
let question = $ref<Question | null>(null)
let index = $ref(0)
let allWords: Word[] = []
let testWords: Word[] = []
const currentWord = $computed(() => question?.candidates[question.correctIndex]?.word)

function openCollectPicker(word: Word, event: MouseEvent) {
  openWordCollectPicker(word, event.currentTarget as HTMLElement, {
    excludeDictId: dict?.id,
  })
}

function buildCurrentQuestion() {
  const word = testWords[index]
  question = word ? buildQuestion(word, allWords) : null
}

async function init() {
  let dictId: any = route.params.id
  let d = base.word.bookList.find(v => v.id === dictId)
  if (!d) d = base.sdict
  if (!d?.id) return router.push('/words')
  if (!d.words.length && runtimeStore.editDict?.id === d.id) {
    loading = true
    let r = await _getDictDataByUrl(runtimeStore.editDict)
    d = r
    loading = false
  }
  dict = d
  if (!dict.words.length) {
    return Toast.warning('没有单词可测试！')
  }
  if (runtimeStore.routeData.taskWords) {
    let currentStudy: TaskWords = runtimeStore.routeData.taskWords
    if (currentStudy.review.length) {
      testWords = toRaw(currentStudy.review).slice()
    }
  }
  if (!testWords.length) {
    testWords = shuffle(toRaw(dict.words))
  }
  allWords = toRaw(dict.words).slice()
  index = 0
  // 按需生成当前题，避免进入页面时连续遍历整本词典生成 100 道题。
  buildCurrentQuestion()

  if (settingStore.wordSound) playCurrentWord(false)

  Toast.info('按快捷键进行选择,例如按快捷键[' + aShortcutKey + ']选择A', { duration: 3000 })
}

let submitted = $ref(false)
let selectedIndex = $ref(-1)
function select(i: number) {
  const q = question
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

function playCurrentWord(handle = true) {
  if (!question) return
  const word = question.candidates[question.correctIndex]?.word.word
  if (word) playWordAudio(word, handle)
}

function next() {
  closeWordCollectPicker()
  submitted = false
  selectedIndex = -1
  if (index + 1 >= testWords.length) {
    nav('/words')
    return
  }
  index++
  buildCurrentQuestion()
  if (settingStore.wordSound) playCurrentWord(false)
}

function end() {
  closeWordCollectPicker()
  router.back()
}

useStartKeyboardEventListener()

useEvents([
  [ShortcutKey.ChooseA, () => select(0)],
  [ShortcutKey.ChooseB, () => select(1)],
  [ShortcutKey.ChooseC, () => select(2)],
  [ShortcutKey.ChooseD, () => select(3)],
  [ShortcutKey.WordTestingNext, () => next()],
  [ShortcutKey.PlayWordPronunciation, () => playCurrentWord()],
])

const settingStore = useSettingStore()

let aShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseA]
let bShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseB]
let cShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseC]
let dShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.ChooseD]

let nextShortcutKey = settingStore.shortcutKeyMap[ShortcutKey.WordTestingNext]

onMounted(init)
onUnmounted(closeWordCollectPicker)
</script>

<template>
  <BasePage>
    <div class="card flex flex-col text-xl">
      <div class="flex items-center justify-between">
        <div class="page-title">测试：{{ dict?.name }}</div>
        <div class="text-base">{{ index + 1 }} / {{ testWords.length }}</div>
      </div>
      <div class="line my-2"></div>

      <div v-if="question" class="flex flex-col gap-4">
        <div v-if="currentWord" class="text-4xl en-article-family flex flex-wrap items-center gap-2">
          <span>{{ currentWord.word }}</span>
          <VolumeIcon
            :title="`发音(${settingStore.shortcutKeyMap[ShortcutKey.PlayWordPronunciation]})`"
            :cb="playCurrentWord"
          />
          <BaseIcon
            :title="isWordCollect(currentWord) ? $t('uncollect') : $t('collect')"
            @click.stop="toggleWordCollect(currentWord)"
          >
            <IconFluentStar16Filled v-if="isWordCollect(currentWord)" />
            <IconFluentStar16Regular v-else />
          </BaseIcon>
          <BaseIcon :title="$t('collect_to_dict')" @click.stop="openCollectPicker(currentWord, $event)">
            <IconFluentStarAdd16Regular />
          </BaseIcon>
        </div>
        <div class="grid gap-6">
          <div
            v-for="(opt, i) in question.candidates"
            :key="i"
            class="option border rounded cursor-pointer"
            :class="{
              'text-green-600': submitted && i === question.correctIndex,
              'text-red-600': submitted && i === selectedIndex && i !== question.correctIndex,
            }"
            @click="submitted ? playWordAudio(opt.word.word) : select(i)"
          >
            <span class="">
              <span class="italic">{{ ['A', 'B', 'C', 'D'][i] }}</span>
              <span class="mx-2">[{{ [aShortcutKey, bShortcutKey, cShortcutKey, dShortcutKey][i] }}]</span>
              <TranslationList :word="opt.word" :show-full="false"></TranslationList>
            </span>
            <div
              class="flex items-center gap-2"
              :class="{ 'cursor-pointer': submitted }"
              v-opacity="submitted"
              @click.stop="submitted && playWordAudio(opt.word.word)"
            >
              <span>{{ opt.word.word }}</span>
              <VolumeIcon v-if="submitted" :title="'发音'" :cb="() => playWordAudio(opt.word.word)" />
              <template v-if="submitted">
                <BaseIcon
                  :title="isWordCollect(opt.word) ? $t('uncollect') : $t('collect')"
                  @click.stop="toggleWordCollect(opt.word)"
                >
                  <IconFluentStar16Filled v-if="isWordCollect(opt.word)" />
                  <IconFluentStar16Regular v-else />
                </BaseIcon>
                <BaseIcon :title="$t('collect_to_dict')" @click.stop="openCollectPicker(opt.word, $event)">
                  <IconFluentStarAdd16Regular />
                </BaseIcon>
              </template>
            </div>
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
