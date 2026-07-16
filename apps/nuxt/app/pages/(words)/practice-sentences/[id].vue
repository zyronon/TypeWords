<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BaseButton, Toast } from '@typewords/base'
import PracticeLayout from '@typewords/core/components/PracticeLayout.vue'
import Panel from '@typewords/core/components/Panel.vue'
import Empty from '@typewords/core/components/Empty.vue'
import TypingSentence from '@/components/practice-sentences/TypingSentence.vue'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { useStartKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import { useTTsPlayAudio } from '@typewords/core/hooks/sound.ts'
import { debounce } from '@typewords/core/utils'
import type { SentencePracticeMode } from '~/composables/practice-sentences/types.ts'
import type { Article, Sentence } from '@typewords/core/types/types.ts'
import {
  usePracticeSentenceInit,
  flattenDictSentencePracticeItems,
} from '~/composables/practice-sentences/usePracticeSentenceInit.ts'
import { usePracticeSentencePersistence } from '~/composables/practice-sentences/usePracticeSentencePersistence.ts'
import { usePracticeSentenceSession } from '~/composables/practice-sentences/usePracticeSentenceSession.ts'
import { getDefaultArticle, getDefaultDict, getDefaultWord } from '@typewords/core/types/func.ts'
import WordLookupPopover from '@typewords/core/components/word/WordLookupPopover.vue'

const route = useRoute()
const router = useRouter()
const store = useBaseStore()
const settingStore = useSettingStore()
const ttsPlayAudio = useTTsPlayAudio()
const sentenceInit = usePracticeSentenceInit()
const sentencePersistence = usePracticeSentencePersistence()
const {
  session,
  currentItem,
  isComplete,
  init: initSession,
  applyCache,
  markWrong,
  completeCurrent,
  restart: restartSession,
  snapshot,
} = usePracticeSentenceSession()

const mode = ref<SentencePracticeMode>('followWrite')
const loading = ref(false)
const dictName = ref('')
const dictId = computed(() => String(route.params.id ?? ''))

const modeOptions: Array<{ value: SentencePracticeMode; label: string }> = [
  { value: 'followWrite', label: '跟写' },
  { value: 'dictation', label: '默写' },
  { value: 'listen', label: '听写' },
]

const progressPercent = computed(() => {
  if (!session.items.length) return 0
  return Math.round((Math.min(session.index, session.items.length) / session.items.length) * 100)
})

const activeProgressText = computed(() => {
  if (!session.items.length) return '0 / 0'
  return `${Math.min(session.index + 1, session.items.length)} / ${session.items.length}`
})

function savePracticeData() {
  if (!session.items.length || loading.value) return
  return sentencePersistence.save(snapshot(dictId.value, mode.value, dictName.value))
}

const savePracticeDataDebounced = debounce(() => {
  void savePracticeData()
}, 500)

let dict = $ref(getDefaultDict())
let index = $ref(0)
let word = $computed(() => {
  return dict.words?.[index] ?? getDefaultWord()
})
let sentenceIndex = $ref(0)

async function loadPractice() {
  if (!dictId.value) {
    router.push('/words')
    return
  }

  loading.value = true
  try {
    dict = await sentenceInit.loadDictById(dictId.value)
    if (!dict.id) {
      router.push('/words')
      Toast.warning('词书不存在')
      return
    }

    dictName.value = dict.name
    const items = flattenDictSentencePracticeItems(dict)
    const cache = await sentencePersistence.load()
    if (cache?.dictId === dictId.value && cache.items?.length) {
      mode.value = cache.mode ?? 'followWrite'
      applyCache(cache, items)
    } else {
      initSession(items)
    }

    if (!items.length) {
      Toast.warning('当前词书没有可练习的例句')
    }
  } finally {
    loading.value = false
  }
}

function onCompleteSentence() {
  if (sentenceIndex < word.sentences.length - 1) {
    sentenceIndex++
  } else {
    Toast.success('句子练习完成')
  }
}

function onWrongSentence() {
  markWrong()
  savePracticeDataDebounced()
}

function playCurrentSentence({ sentence }: { sentence: Sentence; handle: boolean }) {
  ttsPlayAudio(sentence.text, {
    volume: settingStore.sentenceSoundVolume / 100,
    rate: settingStore.sentenceSoundSpeed,
  })
}

function restartPractice() {
  restartSession()
  void sentencePersistence.clear()
}

function jumpTo(index: number) {
  if (index < 0 || index >= session.items.length) return
  session.index = index
  savePracticeDataDebounced()
}

function setMode(val: SentencePracticeMode) {
  mode.value = val
}

watch(
  () => store.load,
  storeLoaded => {
    if (storeLoaded && loading.value && !dictName.value) {
      void loadPractice()
    }
  },
  { immediate: true }
)

watch([() => session.index, () => session.wrongIds.length, () => session.completedIds.length, mode], () =>
  savePracticeDataDebounced()
)

onMounted(() => {
  loading.value = true
  if (store.load) {
    void loadPractice()
  }
})

onUnmounted(() => {
  void savePracticeData()
})

useStartKeyboardEventListener()
</script>

<template>
  <PracticeLayout v-loading="loading" panelLeft="var(--word-panel-margin-left)">
    <template v-slot:practice>
      <div class="practice-sentence-page">
        <div class="sentence-topbar">
          <div class="title-block">
            <div class="page-title">{{ dictName || '句子练习' }}</div>
            <div class="page-subtitle">{{ activeProgressText }} · 错句 {{ session.wrongIds.length }}</div>
          </div>

          <div class="mode-switch" role="tablist" aria-label="句子练习模式">
            <BaseButton
              v-for="option in modeOptions"
              :key="option.value"
              class="mode-option"
              :class="{ active: mode === option.value }"
              @click="setMode(option.value)"
            >
              {{ option.label }}
            </BaseButton>
          </div>
        </div>

        <div class="progress-track" aria-hidden="true">
          <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
        </div>

        <div v-if="!isComplete && currentItem" class="current-sentence-wrap">
          <div v-if="currentItem.source.sourceWord?.word" class="current-source-word">
            来源单词：{{ currentItem.source.sourceWord.word }}
          </div>

          <TypingSentence
            v-for="(i, j) in word.sentences"
            :key="j"
            :index="j"
            :sentence="i"
            :active="sentenceIndex === j"
            :show-play-button="true"
            :highlight-words="[word.word]"
            @complete="onCompleteSentence"
            @play="playCurrentSentence"
          />
        </div>

        <div v-else-if="isComplete" class="complete-state">
          <div class="complete-title">练习完成</div>
          <div class="complete-grid">
            <div class="complete-item">
              <div class="num">{{ session.items.length }}</div>
              <div class="label">总句数</div>
            </div>
            <div class="complete-item">
              <div class="num">{{ session.wrongIds.length }}</div>
              <div class="label">错句数</div>
            </div>
            <div class="complete-item">
              <div class="num">{{ progressPercent }}%</div>
              <div class="label">完成度</div>
            </div>
          </div>
          <BaseButton
            class="action-control primary"
            role="button"
            tabindex="0"
            @click="restartPractice"
            @keydown.enter.prevent="restartPractice"
            @keydown.space.prevent="restartPractice"
          >
            <IconFluentArrowClockwise20Regular />
            <span>重新开始</span>
          </BaseButton>
        </div>

        <div v-else class="empty-wrap">
          <Empty />
        </div>
      </div>
    </template>

    <template v-slot:panel>
      <Panel>
        <template v-slot:title>
          <div class="panel-title">
            <span>句子列表</span>
            <span class="panel-count">{{ session.items.length }}</span>
          </div>
        </template>
        <div class="sentence-list">
          <div
            v-for="(item, index) in session.items"
            :key="item.id"
            class="sentence-list-item"
            :class="{
              active: index === session.index,
              done: session.completedIds.includes(item.id),
              wrong: session.wrongIds.includes(item.id),
            }"
            role="button"
            tabindex="0"
            @click="jumpTo(index)"
            @keydown.enter.prevent="jumpTo(index)"
            @keydown.space.prevent="jumpTo(index)"
          >
            <div class="list-item-head">
              <span class="list-index">{{ index + 1 }}</span>
              <span v-if="item.source.sourceWord?.word" class="list-word">{{ item.source.sourceWord.word }}</span>
            </div>
            <div class="list-text">{{ item.source.text }}</div>
          </div>
          <Empty v-if="!session.items.length" />
        </div>
      </Panel>
    </template>

    <template v-slot:footer>
      <div class="sentence-footer">
        <BaseButton
          class="footer-control"
          role="button"
          tabindex="0"
          @click="settingStore.showPanel = !settingStore.showPanel"
        >
          <IconFluentTextBulletListSquare20Regular />
          <span>列表</span>
        </BaseButton>
        <div class="footer-progress">{{ activeProgressText }}</div>
        <BaseButton class="footer-control" role="button" tabindex="0" @click="restartPractice">
          <IconFluentArrowClockwise20Regular />
          <span>重练</span>
        </BaseButton>
      </div>
    </template>
  </PracticeLayout>
  <WordLookupPopover />
</template>

<style scoped lang="scss">
.practice-sentence-page {
  @apply h-full w-full max-w-240 mx-auto px-4 pt-10 pb-32 flex flex-col gap-5;
  color: var(--color-font-2);
}

.sentence-topbar {
  @apply flex items-start justify-between gap-4 flex-wrap;
}

.title-block {
  @apply min-w-0;
}

.page-title {
  @apply text-2xl font-bold color-main;
}

.page-subtitle {
  @apply mt-1 text-sm;
  color: var(--color-font-1);
}

.mode-switch {
  @apply inline-flex rounded-lg border border-item-solid bg-[var(--bg-card-primary)] p-1;
}

.mode-option {
  @apply min-h-10 min-w-16 center rounded-md px-3 text-sm cp transition-colors duration-200;

  &.active {
    @apply bg-[var(--color-select-bg)] color-reverse-white;
  }
}

.progress-track {
  @apply h-2 w-full overflow-hidden rounded-full bg-[var(--bg-card-secend)];
}

.progress-bar {
  @apply h-full bg-[var(--color-select-bg)] transition-all duration-300;
}

.current-sentence-wrap {
  @apply flex flex-col gap-3;
}

.current-source-word {
  @apply w-fit rounded-lg bg-[var(--bg-card-primary)] px-3 py-2 text-sm color-main;
}

.complete-state,
.empty-wrap {
  @apply min-h-100 rounded-lg border border-item-solid bg-[var(--bg-card-primary)] p-6 center flex-col;
}

.complete-title {
  @apply text-2xl font-bold mb-5 color-main;
}

.complete-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-150 mb-5;
}

.complete-item {
  @apply rounded-lg bg-[var(--bg-card-secend)] px-4 py-4 text-center;

  .num {
    @apply text-2xl font-bold color-main;
  }

  .label {
    @apply mt-1 text-sm;
    color: var(--color-font-1);
  }
}

.action-control {
  @apply min-h-11 inline-flex items-center gap-2 rounded-lg px-4 cp transition-colors duration-200;

  &.primary {
    @apply bg-[var(--color-select-bg)] color-reverse-white;
  }
}

.panel-title {
  @apply center gap-2;
}

.panel-count {
  @apply rounded-md bg-[var(--bg-card-secend)] px-2 py-0.5 text-xs;
}

.sentence-list {
  @apply max-h-[calc(100vh-8rem)] overflow-y-auto px-3 pb-4;
}

.sentence-list-item {
  @apply rounded-lg border border-item-solid bg-[var(--bg-card-primary)] p-3 mb-2 cp transition-colors duration-200;

  &.active {
    box-shadow: inset 0 0 0 1px var(--color-select-bg);
  }

  &.done {
    @apply bg-green-500/10;
  }

  &.wrong {
    @apply bg-red-500/10;
  }
}

.list-item-head {
  @apply flex items-center gap-2 mb-1;
}

.list-index,
.list-word {
  @apply inline-flex items-center min-h-7 rounded-md px-2 text-xs;
}

.list-index {
  @apply bg-[var(--color-select-bg)] color-reverse-white;
}

.list-word {
  @apply bg-[var(--bg-card-secend)] color-main;
}

.list-text {
  @apply text-sm leading-relaxed;
  font-family: var(--en-article-family);
  letter-spacing: 0;
  word-break: break-word;
}

.sentence-footer {
  @apply min-h-13 rounded-lg border border-item-solid bg-[var(--bg-card-primary)] px-3 py-2 flex items-center gap-4 shadow-lg;
}

.footer-control {
  @apply min-h-10 min-w-16 center gap-1 rounded-md px-3 cp transition-colors duration-200 hover:bg-[var(--bg-card-secend)];
}

.footer-progress {
  @apply min-w-20 text-center text-sm color-main;
}

@media (max-width: 768px) {
  .practice-sentence-page {
    @apply px-2 pt-5 pb-24;
  }

  .sentence-topbar {
    @apply flex-col;
  }

  .mode-switch {
    @apply w-full;
  }

  .mode-option {
    @apply flex-1;
  }

  .sentence-footer {
    @apply w-full justify-between;
  }
}
</style>
