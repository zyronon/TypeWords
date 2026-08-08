<script setup lang="ts">
/**
 * TypingArticleV2 — 基于 TypingSentenceItem 组合的文章练习组件
 *
 * 用于验证新架构在文章侧可行。每个句子渲染为一个 TypingSentenceItem，
 * 文章级组件管理句子间导航、翻译叠层、持久化、人名跳过等。
 */
import { BaseButton, Toast, VolumeIcon } from '@/base'
import { openWordCollectPicker } from '@/core/hooks/useWordCollectPicker.ts'
import { usePlayBeep, usePlayKeyboardAudio, usePlayWordAudio } from '@/core/hooks/sound.ts'
import TypingSentenceItem from '@/components/practice-sentences/TypingSentenceItem.vue'
import ClickableEnglishText from '@/core/components/word/ClickableEnglishText.vue'
import WordLookupPopover from '@/core/components/word/WordLookupPopover.vue'
import { lookupWord } from '@/core/hooks/useWordLookup.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { usePracticeStore } from '@/core/stores/practice.ts'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { getDefaultArticle, getDefaultWord } from '@/core/types/func.ts'
import type { Article, ArticleWord, Sentence, Word } from '@/core/types/types.ts'
import { PracticeArticleWordType } from '@/core/types/enum.ts'
import { _dateFormat, _nextTick, debounce, msToHourMinute, total } from '@/core/utils'
import { emitter, EventKey } from '@/core/utils/eventBus.ts'
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import nlp from 'compromise/three'
import { nanoid } from 'nanoid'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePracticeArticlePersistence } from '@/core/composables/usePracticePersistence'
import type { PracticeArticleCache } from '@/core/utils/cache'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

interface IProps {
  article: Article
}

const props = withDefaults(defineProps<IProps>(), {
  article: () => getDefaultArticle(),
})

const emit = defineEmits<{
  wrong: [val: Word]
  play: [
    val: {
      sentence: Sentence
      handle: boolean
    },
  ]
  playArticleTextAudio: [
    val: {
      text: string
      start?: number
      end?: number
    },
  ]
  complete: []
  next: []
  replay: []
  ignore: []
}>()

const store = useBaseStore()
const settingStore = useSettingStore()
const statStore = usePracticeStore()
const runtimeStore = useRuntimeStore()
const articlePersistence = usePracticeArticlePersistence()

// ============ 文章级导航状态 ============

let typeArticleRef = $ref<HTMLDivElement>()
let articleWrapperRef = $ref<HTMLDivElement>()
let sectionIndex = $ref(0)
let sentenceIndex = $ref(0)
let isEnd = $ref(false)

// 存储每个 TypingSentenceItem 的 ref（key = `${i}-${j}`）
const itemRefs = ref<Map<string, InstanceType<typeof TypingSentenceItem>>>(new Map())

function setItemRef(i: number, j: number, el: any) {
  if (el) {
    itemRefs.value.set(`${i}-${j}`, el)
  }
}

function getCurrentItemRef() {
  return itemRefs.value.get(`${sectionIndex}-${sentenceIndex}`)
}

const totalSentences = computed(() => {
  let count = 0
  props.article.sections.forEach(section => {
    count += section.length
  })
  return count
})

// ============ 人名跳过 ============

const normalize = (s: string) => s.toLowerCase().trim()
const namePatterns = $computed(() => {
  return Array.from(
    new Set(
      (props.article?.nameList ?? [])
        .map(normalize)
        .filter(Boolean)
        .map(s => s.split(/\s+/).filter(Boolean))
        .flat()
        .concat(['Mr', 'Mrs', 'Ms', 'Dr', 'Miss'].map(normalize))
    )
  )
})

function isNameSentence(sentence: Sentence) {
  if (!namePatterns.length) return false
  const words = sentence.words ?? []
  if (words.length === 0) return false
  const firstWord = words[0]
  return firstWord?.type === PracticeArticleWordType.Word && namePatterns.includes(normalize(firstWord.word))
}

// ============ 持久化 ============

const savePracticeData = async () => {
  if (runtimeStore.globalLoading || isEnd) return
  runtimeStore.globalLoading = true
  try {
    await articlePersistence.save({
      practiceData: { sectionIndex, sentenceIndex, wordIndex: 0 },
      statStoreData: statStore.$state,
    })
  } finally {
    runtimeStore.globalLoading = false
  }
}

const save = debounce(() => {
  void savePracticeData()
}, 1500)

watch([() => sectionIndex, () => sentenceIndex], ([a, b]) => {
  if (a !== 0 || b !== 0) save()
})

// ============ 初始化 ============

async function init() {
  if (!props.article.id) return
  isEnd = false

  const cache = await articlePersistence.load()
  if (cache?.practiceData) {
    sectionIndex = cache.practiceData.sectionIndex ?? 0
    sentenceIndex = cache.practiceData.sentenceIndex ?? 0
    statStore.$patch(cache.statStoreData ?? {})
    applyPracticeCache(cache)
  } else {
    sectionIndex = 0
    sentenceIndex = 0
    // 重置所有 word input
    props.article.sections.forEach(section => {
      section.forEach(sentence => {
        sentence.words.forEach(word => {
          word.input = ''
        })
      })
    })
    window.scrollTo({ top: 0 })
  }

  _nextTick(() => {
    const sentence = props.article.sections[sectionIndex]?.[sentenceIndex]
    if (sentence) {
      emit('play', { sentence, handle: false })
      if (isNameSentence(sentence)) nextSentence()
    }
  })
}

function applyPracticeCache(cache: PracticeArticleCache) {
  if (!cache?.practiceData) return
  const { sectionIndex: i = 0, sentenceIndex: j = 0 } = cache.practiceData
  statStore.$patch(cache.statStoreData ?? {})
  // 补全跳过的句子 input
  props.article.sections.forEach((section, si) => {
    section.forEach((sentence, sj) => {
      sentence.words.forEach((word, wk) => {
        if (si < i || (si === i && sj < j)) {
          word.input = word.word
        } else {
          word.input = ''
        }
      })
    })
  })
  sectionIndex = i
  sentenceIndex = j
}

// ============ 句子间导航 ============

let navLock = false

async function nextSentence() {
  if (navLock || isEnd) return
  navLock = true

  // 补全当前句子
  const currentSection = props.article.sections[sectionIndex]
  const currentSentence = currentSection?.[sentenceIndex]
  if (currentSentence) {
    currentSentence.words.forEach(word => {
      word.input = (word.input ?? '') + word.word.slice(word.input?.length ?? 0)
    })
  }

  sentenceIndex++
  if (!currentSection?.[sentenceIndex]) {
    sentenceIndex = 0
    sectionIndex++
    if (!props.article.sections[sectionIndex]) {
      runtimeStore.globalLoading = true
      await articlePersistence.clear()
      runtimeStore.globalLoading = false
      isEnd = true
      emit('complete')
      navLock = false
      return
    } else {
      const nextSec = props.article.sections[sectionIndex]
      if (nextSec?.[0]) {
        emit('play', { sentence: nextSec[0], handle: false })
      }
      if (nextSec?.[0] && isNameSentence(nextSec[0])) nextSentence()
    }
  } else {
    const nextSentence = currentSection[sentenceIndex]
    if (nextSentence) {
      emit('play', { sentence: nextSentence, handle: false })
    }
    if (nextSentence && isNameSentence(nextSentence)) nextSentence()
  }

  navLock = false
  checkCurrentScroll()
}

function prevSentence() {
  if (isEnd) return
  if (sentenceIndex > 0) {
    sentenceIndex--
  } else if (sectionIndex > 0) {
    sectionIndex--
    sentenceIndex = Math.max(0, (props.article.sections[sectionIndex]?.length ?? 1) - 1)
  }
}

function checkCurrentScroll() {
  nextTick(() => {
    const sentenceEl = document.querySelector(`#article-section-${sectionIndex} #article-sentence-${sectionIndex}-${sentenceIndex}`)
    if (sentenceEl) {
      const rect = sentenceEl.getBoundingClientRect()
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  })
}

// ============ 句子完成回调 ============

function onItemComplete(i: number, j: number) {
  // 确保是当前激活的句子
  if (i !== sectionIndex || j !== sentenceIndex) return
  nextSentence()
}

// ============ 键盘事件（仅处理跨句 Backspace） ============

function isCurrentSection(i: number, j: number) {
  return i === sectionIndex && j === sentenceIndex && !isEnd
}

function onArticleKeyDown(e: KeyboardEvent) {
  if (isEnd) return
  if (e.key === 'Backspace') {
    const currentItem = getCurrentItemRef()
    if (!currentItem) return
    // 调用子组件的 del
    currentItem.del()
    // 如果子组件已到句首，判断是否需要跨句回退
    if (currentItem.wordIndex === 0 && !currentItem.isEnd) {
      const word = currentItem.currentWord
      if (word && currentItem.wordIndex === 0) {
        // 子组件内部已处理句首 return，父组件检测到需要跨句回退
        const currentInput = word.input ?? ''
        // 当前句子已全部回退完，尝试回到上一句
        if (!currentInput.length && (sentenceIndex > 0 || sectionIndex > 0)) {
          prevSentence()
          nextTick(() => {
            const prevItem = getCurrentItemRef()
            if (prevItem) {
              // 跳到上一句的末尾
              prevItem.reset()
              prevItem.isEnd.value = true
              prevItem.del()
            }
          })
        }
      }
    }
    e.preventDefault()
  }
}

// ============ 右键菜单 ============

function onContextMenu(e: MouseEvent, sentence: Sentence, i: number, j: number, wordIndex: number) {
  e.preventDefault()
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: $t('collect_word'),
        onClick: () => {
          const word = props.article.sections[i][j].words[wordIndex]
          let text = word.word
          const doc = nlp(text)
          if (doc.verbs().found) text = doc.verbs().toInfinitive().text()
          if (doc.nouns().found) text = doc.nouns().toSingular().text()
          if (!text.length) text = word.word
          openWordCollectPicker(getDefaultWord({ word: text, id: nanoid() }), { x: e.x, y: e.y })
        },
      },
      {
        label: $t('copy'),
        children: [
          {
            label: $t('copy_sentence'),
            onClick: () => {
              navigator.clipboard.writeText(sentence.text).then(() => Toast.success($t('copied')))
            },
          },
          {
            label: $t('copy_word'),
            onClick: () => {
              const word = props.article.sections[i][j].words[wordIndex]
              navigator.clipboard.writeText(word.word).then(() => Toast.success($t('copied')))
            },
          },
        ],
      },
      {
        label: $t('start_from_here'),
        onClick: () => {
          sectionIndex = i
          sentenceIndex = j
          // 重置当前和之后句子的 input
          props.article.sections.forEach((section, si) => {
            section.forEach((sent, sj) => {
              sent.words.forEach((word, wk) => {
                if (si < i || (si === i && sj < j)) {
                  word.input = word.word
                } else {
                  word.input = ''
                }
              })
            })
          })
          const item = getCurrentItemRef()
          item?.reset()
          emit('play', { sentence, handle: false })
        },
      },
      {
        label: $t('play_sentence'),
        onClick: () => emit('play', { sentence, handle: true }),
      },
      {
        label: $t('grammar_analysis'),
        onClick: () => {
          navigator.clipboard.writeText(sentence.text).then(() => {
            Toast.success($t('copied_open_grammar'))
            setTimeout(() => window.open('https://enpuz.com/'), 1000)
          })
        },
      },
      {
        label: $t('youdao_translate'),
        children: [
          {
            label: $t('translate_word'),
            onClick: () => {
              const word = props.article.sections[i][j].words[wordIndex]
              window.open(`https://www.youdao.com/result?word=${word.word}&lang=en`, '_blank')
            },
          },
          {
            label: $t('translate_sentence'),
            onClick: () => window.open(`https://www.youdao.com/result?word=${sentence.text}&lang=en`, '_blank'),
          },
        ],
      },
    ],
  })
}

function onWordClick(e: MouseEvent, wordText: string) {
  lookupWord(e, wordText, usePlayWordAudio())
}

// ============ 音频 ============

function playArticleTitleAudio() {
  emit('playArticleTextAudio', { text: props.article?.title ?? '' })
}

function playArticleQuestionAudio() {
  if (!props.article?.question?.text) return
  emit('playArticleTextAudio', {
    text: props.article.question.text,
    start: props.article.question.start,
    end: props.article.question.end,
  })
}

function playArticleQuoteAudio() {
  if (!props.article?.quote?.text) return
  emit('playArticleTextAudio', {
    text: props.article.quote.text,
    start: props.article.quote.start,
    end: props.article.quote.end,
  })
}

// ============ 翻译叠层定位 ============

function checkTranslateLocation() {
  return new Promise<void>(resolve => {
    _nextTick(() => {
      const articleRect = articleWrapperRef?.getBoundingClientRect()
      if (!articleRect) { resolve(); return }
      props.article.sections.forEach((section, i) => {
        section.forEach((sentence, j) => {
          const wordEl = document.querySelector(`#article-section-${i} #word${i}-${j}`)
          const translateEl = document.querySelector(`#translate-${i}-${j}`) as HTMLDivElement
          if (!wordEl || !translateEl) return
          const wordRect = wordEl.getBoundingClientRect()
          translateEl.style.opacity = '1'
          translateEl.style.top = wordRect.top - articleRect.top + 24 + 'px'
          translateEl.style.position = 'absolute'
          translateEl.style.left = '0'
          translateEl.style.width = '100%'
        })
      })
      resolve()
    }, 300)
  })
}

watch(() => settingStore.translate, () => {
  checkTranslateLocation()
})

// ============ 生命周期 ============

onMounted(() => {
  init()
  emitter.on(EventKey.resetWord, () => {})
  emitter.on(EventKey.onTyping, onArticleKeyDown)
})

onUnmounted(() => {
  emitter.off(EventKey.resetWord)
  emitter.off(EventKey.onTyping, onArticleKeyDown)
})

const currentPractice = inject('currentPractice', [])

defineExpose({
  init,
  play: () => {
    const sentence = props.article.sections[sectionIndex]?.[sentenceIndex]
    if (sentence) emit('play', { sentence, handle: true })
  },
  nextSentence,
})
</script>

<template>
  <div class="typing-article-v2" ref="typeArticleRef">
    <!-- Header -->
    <header class="md:pt-10 pb-6">
      <div class="text-center">
        <span class="text-3xl">{{ store.sbook.lastLearnIndex + 1 }}. </span>
        <span class="inline-flex items-center gap-1">
          <ClickableEnglishText class="text-3xl" :text="props.article?.title ?? ''" word="" :dictation="false" :high-light="false" />
          <VolumeIcon :simple="true" :title="$t('play')" :cb="playArticleTitleAudio" />
        </span>
        <span class="ml-6 text-2xl" v-if="settingStore.translate">{{ props.article?.titleTranslate }}</span>
      </div>

      <div class="mt-2 text-2xl" v-if="props.article?.question?.text">
        <div class="inline-flex items-center gap-1 flex-wrap">
          <span>Question:</span>
          <ClickableEnglishText :text="props.article?.question?.text" word="" :dictation="false" :high-light="false" />
          <VolumeIcon :simple="true" :title="$t('play')" :cb="playArticleQuestionAudio" />
        </div>
        <div class="text-xl color-translate-second" v-if="settingStore.translate">
          问题: {{ props.article?.question?.translate }}
        </div>
      </div>
    </header>

    <!-- Article Content -->
    <div id="article-content" class="article-content" ref="articleWrapperRef"
      :class="[settingStore.translate && 'tall', settingStore.dictation && 'dictation']">
      <article>
        <div
          v-for="(section, i) in props.article.sections"
          :key="i"
          :id="`article-section-${i}`"
          class="section"
        >
          <div
            v-for="(sentence, j) in section"
            :key="`${i}-${j}`"
            :id="`article-sentence-${i}-${j}`"
            class="sentence"
          >
            <TypingSentenceItem
              :ref="el => setItemRef(i, j, el)"
              :sentence="sentence"
              :active="isCurrentSection(i, j)"
              :dictation="settingStore.dictation"
              @complete="onItemComplete(i, j)"
              @play="emit('play', { sentence, handle: $event.handle })"
              @context-menu="(e) => onContextMenu(e.event, sentence, i, j, e.wordIndex)"
              @word-click="(e) => onWordClick(e.event, e.wordText)"
            />
          </div>
        </div>
      </article>

      <!-- 翻译叠层 -->
      <div class="translate" v-show="settingStore.translate">
        <template v-for="(section, i) in props.article.sections" :key="'t-' + i">
          <div
            v-for="(sentence, j) in section"
            :key="`t-${i}-${j}`"
            :id="`translate-${i}-${j}`"
            class="row"
            :class="[
              sectionIndex > i ? 'wrote' : sectionIndex >= i && sentenceIndex > j ? 'wrote' : '',
            ]"
          >
            <Transition name="fade">
              <span class="text" v-if="sentence.translate">{{ sentence.translate }}</span>
            </Transition>
          </div>
        </template>
      </div>
    </div>

    <!-- Footer -->
    <div class="options flex justify-center" v-if="isEnd">
      <BaseButton @click="emit('replay')">{{ $t('restart_practice') }}</BaseButton>
      <BaseButton v-if="store.sbook.lastLearnIndex < store.sbook.articles.length - 1" @click="emit('next')">
        {{ $t('next_article') }}
      </BaseButton>
    </div>

    <!-- Learning Records -->
    <div class="font-family text-base pr-2 mb-50 mt-10" v-if="currentPractice.length && isEnd">
      <div class="text-2xl font-bold">{{ $t('learning_record') }}</div>
      <div class="mt-1 mb-3">
        {{ $t('total_learning_time') }}：{{ msToHourMinute(total(currentPractice, 'spend')) }}
      </div>
      <div
        class="item border border-item border-solid mt-2 p-2 bg-[var(--bg-history)] rounded-md flex justify-between"
        :class="i === currentPractice.length - 1 && 'color-red!'"
        v-for="(item, i) in currentPractice"
        :key="i"
      >
        <span :class="i === currentPractice.length - 1 ? 'color-red' : 'color-gray'"
        >{{ i === currentPractice.length - 1 ? $t('current') : i + 1 }}.&nbsp;&nbsp;{{ _dateFormat(item.startDate) }}</span
        >
        <span>{{ msToHourMinute(item.spend) }}</span>
      </div>
    </div>

    <WordLookupPopover />
  </div>
</template>

<style scoped lang="scss">
.typing-article-v2 {
  color: var(--color-article);
  width: var(--article-width);
  font-size: 1.6rem;
  margin-bottom: 20rem;

  .article-content {
    position: relative;
  }

  .dictation {
    .border-bottom {
      display: inline-block !important;
    }
    .translate {
      color: var(--color-reverse-black);
    }
  }

  .tall {
    article {
      line-height: 2.4;
    }
  }

  article {
    word-break: keep-all;
    word-wrap: break-word;

    .section {
      &:not(:last-child) {
        margin-bottom: 1.5rem;
      }

      .sentence {
        transition: all 0.3s;
      }
    }
  }

  .translate {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    font-size: 1.2rem;
    line-height: 3.2;
    letter-spacing: 0.2rem;
    font-family: var(--zh-article-family);
    font-weight: bold;
    color: #818181;

    .row {
      position: absolute;
      left: 0;
      width: 100%;
      opacity: 0;
      transition: all 0.3s;

      &.wrote {
        opacity: 0;
      }
    }
  }
}

.sentence-translate-mobile {
  display: none;
}

@media (max-width: 768px) {
  .typing-article-v2 {
    max-width: 100%;
  }
}
</style>
