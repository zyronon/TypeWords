<script setup lang="ts">

import { onMounted, provide, watch } from "vue";

import Statistics from "@/pages/word/Statistics.vue";
import { emitter, EventKey, useEvents } from "@/utils/eventBus.ts";
import { useSettingStore } from "@/stores/setting.ts";
import { useRuntimeStore } from "@/stores/runtime.ts";
import { Dict, PracticeData, ShortcutKey, TaskWords, Word } from "@/types/types.ts";
import { useDisableEventListener, useOnKeyboardEventListener, useStartKeyboardEventListener } from "@/hooks/event.ts";
import useTheme from "@/hooks/theme.ts";
import { getCurrentStudyWord, useWordOptions } from "@/hooks/dict.ts";
import { _getDictDataByUrl, cloneDeep, resourceWrap, shuffle } from "@/utils";
import { useRoute, useRouter } from "vue-router";
import Footer from "@/pages/word/components/Footer.vue";
import Panel from "@/components/Panel.vue";
import BaseIcon from "@/components/BaseIcon.vue";
import Tooltip from "@/components/base/Tooltip.vue";
import WordList from "@/components/list/WordList.vue";
import TypeWord from "@/pages/word/components/TypeWord.vue";
import Empty from "@/components/Empty.vue";
import { useBaseStore } from "@/stores/base.ts";
import { usePracticeStore } from "@/stores/practice.ts";
import Toast from '@/components/base/toast/Toast.ts'
import { getDefaultDict, getDefaultWord } from "@/types/func.ts";
import ConflictNotice from "@/components/ConflictNotice.vue";
import PracticeLayout from "@/components/PracticeLayout.vue";

import { DICT_LIST, PracticeSaveWordKey } from "@/config/env.ts";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const {
  isWordCollect,
  toggleWordCollect,
  isWordSimple,
  toggleWordSimple
} = useWordOptions()
const settingStore = useSettingStore()
const runtimeStore = useRuntimeStore()
const {toggleTheme} = useTheme()
const router = useRouter()
const route = useRoute()
const store = useBaseStore()
const statStore = usePracticeStore()
const typingRef: any = $ref()
let allWrongWords = new Set()
let showStatDialog = $ref(false)
let loading = $ref(false)
let taskWords = $ref<TaskWords>({
  new: [],
  review: [],
  write: []
})

let data = $ref<PracticeData>({
  index: 0,
  words: [],
  wrongWords: [],
})

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
        router.push('/word')
        return Toast.warning(t('NoWordsToLearn'))
      }
      store.changeDict(dict)
      initData(getCurrentStudyWord(), true)
      loading = false
    } else {
      router.push('/word')
    }
  } else {
    router.push('/word')
  }
}

watch(() => store.load, (n) => {
  if (n && loading) loadDict()
}, {immediate: true})


onMounted(() => {
  //如果是从单词学习主页过来的，就直接使用；否则等待加载
  if (runtimeStore.routeData) {
    initData(runtimeStore.routeData, true)
  } else {
    loading = true
  }
})

useStartKeyboardEventListener()
useDisableEventListener(() => loading)

function initData(initVal: TaskWords, init: boolean = false) {
  let d = localStorage.getItem(PracticeSaveWordKey.key)
  if (d && init) {
    try {
      let obj = JSON.parse(d)
      let s = obj.val
      taskWords = Object.assign(taskWords, s.taskWords)
      //这里直接赋值的话，provide后的inject获取不到最新值
      data = Object.assign(data, s.practiceData)
      statStore.$patch(s.statStoreData)
    } catch (e) {
      localStorage.removeItem(PracticeSaveWordKey.key)
      initData(initVal, true)
    }
  } else {
    taskWords = initVal
    if (taskWords.new.length === 0) {
      if (taskWords.review.length) {
        settingStore.dictation = false
        statStore.step = 2
        data.words = taskWords.review
      } else {
        if (taskWords.write.length) {
          settingStore.dictation = true
          data.words = taskWords.write
          statStore.step = 4
        } else {
          Toast.warning(t('NoWordsToLearn'))
          router.push('/word')
        }
      }
    } else {
      settingStore.dictation = false
      data.words = taskWords.new
      statStore.step = 0
    }
    data.index = 0
    data.wrongWords = []
    allWrongWords.clear()
    statStore.startDate = Date.now()
    statStore.inputWordNumber = 0
    statStore.wrong = 0
    statStore.total = taskWords.review.length + taskWords.new.length + taskWords.write.length
    statStore.newWordNumber = taskWords.new.length
    statStore.reviewWordNumber = taskWords.review.length
    statStore.writeWordNumber = taskWords.write.length
    statStore.index = 0
  }
}

provide('practiceData', data)

const word = $computed(() => {
  return data.words[data.index] ?? getDefaultWord()
})
const prevWord: Word = $computed(() => {
  return data.words?.[data.index - 1] ?? undefined
})
const nextWord: Word = $computed(() => {
  return data.words?.[data.index + 1] ?? undefined
})

function next(isTyping: boolean = true) {
  // showStatDialog = true
  // return
  if (data.index === data.words.length - 1) {
    if (data.wrongWords.length) {
      console.log('当前学完了，但还有错词')
      data.words = shuffle(cloneDeep(data.wrongWords))
      data.index = 0
      data.wrongWords = []
    } else {
      console.log('当前学完了，没错词', statStore.total, statStore.step, data.index)
      if (isTyping) statStore.inputWordNumber++

      //学完了
      if (statStore.step === 4) {
        statStore.spend = Date.now() - statStore.startDate
        console.log('全完学完了')
        showStatDialog = true
        localStorage.removeItem(PracticeSaveWordKey.key)
        return;
        // emit('complete', {})
      }

      //开始默认所有单词
      if (statStore.step === 3) {
        statStore.step++
        if (taskWords.write.length) {
          console.log('开始默认所有单词')
          settingStore.dictation = true
          data.words = shuffle(taskWords.write)
          data.index = 0
        } else {
          console.log('开始默认所有单词-无单词略过')
          return next()
        }
      }

      //开始默写昨日
      if (statStore.step === 2) {
        statStore.step++
        if (taskWords.review.length) {
          console.log('开始默写昨日')
          settingStore.dictation = true
          data.words = shuffle(taskWords.review)
          data.index = 0
        } else {
          console.log('开始默写昨日-无单词略过')
          return next()
        }
      }

      //开始复习昨日
      if (statStore.step === 1) {
        statStore.step++
        if (taskWords.review.length) {
          console.log('开始复习昨日')
          settingStore.dictation = false
          data.words = shuffle(taskWords.review)
          data.index = 0
        } else {
          console.log('开始复习昨日-无单词略过')
          return next()
        }
      }

      //开始默写新词
      if (statStore.step === 0) {
        if (settingStore.wordPracticeMode === 1) {
          console.log('自由模式，全完学完了')
          showStatDialog = true
          localStorage.removeItem(PracticeSaveWordKey.key)
          return
        }
        statStore.step++
        console.log('开始默写新词')
        settingStore.dictation = true
        data.words = shuffle(taskWords.new)
        data.index = 0
      }
    }
  } else {
    data.index++
    isTyping && statStore.inputWordNumber++
    // console.log('这个词完了')
  }
  savePracticeData()
}

function onTypeWrong() {
  let temp = word.word.toLowerCase()
  if (!allWrongWords.has(word.word.toLowerCase())) {
    allWrongWords.add(word.word.toLowerCase())
    statStore.wrong++
  }
  if (!store.wrong.words.find((v: Word) => v.word.toLowerCase() === temp)) {
    store.wrong.words.push(word)
    store.wrong.length = store.wrong.words.length
  }
  if (!data.wrongWords.find((v: Word) => v.word.toLowerCase() === temp)) {
    data.wrongWords.push(word)
  }
  savePracticeData()
}

function savePracticeData() {
  localStorage.setItem(PracticeSaveWordKey.key, JSON.stringify({
    version: PracticeSaveWordKey.version,
    val: {
      taskWords,
      practiceData: data,
      statStoreData: statStore.$state,
    }
  }))
}

watch(() => data.index, savePracticeData)

function onKeyUp(e: KeyboardEvent) {
  // console.log('onKeyUp', e)
  typingRef.hideWord()
}

async function onKeyDown(e: KeyboardEvent) {
  // console.log('onKeyDown', e)
  switch (e.key) {
    case 'Backspace':
      typingRef.del()
      break
  }
}

useOnKeyboardEventListener(onKeyDown, onKeyUp)

function repeat() {
  console.log('重学一遍')
  if (settingStore.wordPracticeMode === 0) settingStore.dictation = false
  if (store.sdict.lastLearnIndex === 0 && store.sdict.complete) {
    //如果是刚刚完成，那么学习进度要从length减回去，因为lastLearnIndex为0了，同时改complete为false
    store.sdict.lastLearnIndex = store.sdict.length - statStore.newWordNumber
    store.sdict.complete = false
  } else {
    //将学习进度减回去
    store.sdict.lastLearnIndex = store.sdict.lastLearnIndex - statStore.newWordNumber
  }
  emitter.emit(EventKey.resetWord)
  let temp = cloneDeep(taskWords)
  //排除已掌握单词
  temp.new = temp.new.filter(v => !store.knownWords.includes(v.word))
  temp.review = temp.review.filter(v => !store.knownWords.includes(v.word))
  temp.write = temp.write.filter(v => !store.knownWords.includes(v.word))
  initData(temp)
}

function prev() {
  if (data.index === 0) {
    Toast.warning('已经是第一个了~')
  } else {
    data.index--
  }
}

function skip(e: KeyboardEvent) {
  next(false)
  // e.preventDefault()
}

function show(e: KeyboardEvent) {
  typingRef.showWord()
}

function collect(e: KeyboardEvent) {
  toggleWordCollect(word)
}

function play() {
  typingRef.play()
}

function toggleWordSimpleWrapper() {
  if (!isWordSimple(word)) {
    toggleWordSimple(word)
    //延迟一下，不知道为什么不延迟会导致当前条目不自动定位到列表中间
    setTimeout(() => next(false))
  } else {
    toggleWordSimple(word)
  }
}

function toggleTranslate() {
  settingStore.translate = !settingStore.translate
}

function toggleDictation() {
  settingStore.dictation = !settingStore.dictation
}

function toggleConciseMode() {
  settingStore.showToolbar = !settingStore.showToolbar
  settingStore.showPanel = settingStore.showToolbar
}

function togglePanel() {
  settingStore.showPanel = !settingStore.showPanel
}

function continueStudy() {
  if (settingStore.wordPracticeMode === 0) settingStore.dictation = false
  if (!showStatDialog) {
    console.log(t('SkippingIncomplete'))
    store.sdict.lastLearnIndex = store.sdict.lastLearnIndex + statStore.newWordNumber
  } else {
    console.log(t('CompletedMovingNext'))
    showStatDialog = false
  }
  initData(getCurrentStudyWord())
}

function randomWrite() {
  console.log('随机默写')
  data.words = shuffle(data.words);
  data.index = 0
  settingStore.dictation = true
}
function nextRandomWrite() {
  console.log('继续随机默写')
  initData(getCurrentStudyWord())
  randomWrite();
  showStatDialog = false
}

useEvents([
  [EventKey.repeatStudy, repeat],
  [EventKey.continueStudy, continueStudy],
  [EventKey.randomWrite, nextRandomWrite],
  [EventKey.changeDict, () => {
    initData(getCurrentStudyWord())
  }],

  [ShortcutKey.ShowWord, show],
  [ShortcutKey.Previous, prev],
  [ShortcutKey.Next, skip],
  [ShortcutKey.ToggleCollect, collect],
  [ShortcutKey.ToggleSimple, toggleWordSimpleWrapper],
  [ShortcutKey.PlayWordPronunciation, play],

  [ShortcutKey.RepeatChapter, repeat],
  [ShortcutKey.NextChapter, continueStudy],
  [ShortcutKey.ToggleShowTranslate, toggleTranslate],
  [ShortcutKey.ToggleDictation, toggleDictation],
  [ShortcutKey.ToggleTheme, toggleTheme],
  [ShortcutKey.ToggleConciseMode, toggleConciseMode],
  [ShortcutKey.TogglePanel, togglePanel],
  [ShortcutKey.RandomWrite, randomWrite],
  [ShortcutKey.NextRandomWrite, nextRandomWrite],
])

</script>

<template>
  <PracticeLayout
      v-loading="loading"
      panelLeft="var(--word-panel-margin-left)">
    <template v-slot:practice>
      <div class="practice-word">
        <div class="absolute z-1 top-4   w-full" v-if="settingStore.showNearWord">
          <div class="center gap-2 cursor-pointer float-left"
               @click="prev"
               v-if="prevWord">
            <IconFluentArrowLeft16Regular class="arrow" width="22"/>
            <Tooltip
                :title="`上一个(${settingStore.shortcutKeyMap[ShortcutKey.Previous]})`"
            >
              <div class="word">{{ prevWord.word }}</div>
            </Tooltip>
          </div>
          <div class="center gap-2 cursor-pointer float-right "
               @click="next(false)"
               v-if="nextWord">
            <Tooltip
                :title="`下一个(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`"
            >
              <div class="word" :class="settingStore.dictation && 'word-shadow'">{{ nextWord.word }}</div>
            </Tooltip>
            <IconFluentArrowRight16Regular class="arrow" width="22"/>
          </div>
        </div>
        <TypeWord
            ref="typingRef"
            :word="word"
            @wrong="onTypeWrong"
            @complete="next"
        />
      </div>
    </template>
    <template v-slot:panel>
      <Panel>
        <template v-slot:title>
          <!--          <span>{{ store.sdict.name }} ({{ data.index + 1 }} / {{ data.words.length }})</span>-->
          <div class="center gap-space">
            <span>{{ store.sdict.name }} ({{ store.sdict.lastLearnIndex }} / {{ store.sdict.length }})</span>

            <BaseIcon
                @click="continueStudy"
                :title="`下一组(${settingStore.shortcutKeyMap[ShortcutKey.NextChapter]})`">
              <IconFluentArrowRight16Regular class="arrow" width="22"/>
            </BaseIcon>
            <BaseIcon
                @click="randomWrite"
                :title="`随机默写(${settingStore.shortcutKeyMap[ShortcutKey.RandomWrite]})`">
              <IconFluentArrowShuffle16Regular class="arrow" width="22"/>
            </BaseIcon>
          </div>
        </template>
        <div class="panel-page-item pl-4">
          <WordList
              v-if="data.words.length"
              :is-active="settingStore.showPanel"
              :static="false"
              :show-word="!settingStore.dictation"
              :show-translate="settingStore.translate"
              :list="data.words"
              :activeIndex="data.index"
              @click="(val:any) => data.index = val.index"
          >
            <template v-slot:suffix="{item,index}">
              <BaseIcon
                  :class="!isWordCollect(item)?'collect':'fill'"
                  @click.stop="toggleWordCollect(item)"
                  :title="!isWordCollect(item) ? '收藏' : '取消收藏'">
                <IconFluentStar16Regular v-if="!isWordCollect(item)"/>
                <IconFluentStar16Filled v-else/>
              </BaseIcon>

              <BaseIcon
                  :class="!isWordSimple(item)?'collect':'fill'"
                  @click.stop="toggleWordSimple(item)"
                  :title="!isWordSimple(item) ? '标记为已掌握' : '取消标记已掌握'">
                <IconFluentCheckmarkCircle16Regular v-if="!isWordSimple(item)"/>
                <IconFluentCheckmarkCircle16Filled v-else/>
              </BaseIcon>
            </template>
          </WordList>
          <Empty v-else/>
        </div>
      </Panel>
    </template>
    <template v-slot:footer>
      <Footer
          :is-simple="isWordSimple(word)"
          @toggle-simple="toggleWordSimpleWrapper"
          :is-collect="isWordCollect(word)"
          @toggle-collect="toggleWordCollect(word)"
          @skip="next(false)"
      />
    </template>
  </PracticeLayout>
  <Statistics v-model="showStatDialog"/>
  <ConflictNotice/>
</template>

<style scoped lang="scss">

.practice-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.practice-word {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  position: relative;
  width: var(--toolbar-width);
}

.word-panel-wrapper {
  position: absolute;
  left: var(--panel-margin-left);
  //left: 0;
  top: .8rem;
  z-index: 1;
  height: calc(100% - 1.5rem);
}
</style>
