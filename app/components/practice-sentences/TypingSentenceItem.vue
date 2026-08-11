<script setup lang="ts">
/**
 * TypingSentenceItem — 纯行内句子打字组件
 *
 * 接收一个 Sentence，自管理打字/删除/光标/键盘事件。
 * 不关心上下文（前后句子），所有外部事件通过 emit 报告给父组件。
 *
 * 可单独使用（练习单句），也可由父组件组装 N 个（练习文章）。
 */
import { nextTick, onUnmounted, watch } from 'vue'
import Space from '@/components/article/Space.vue'
import TypingArticleWord from './TypingArticleWord.vue'
import { useSettingStore } from '@/core/stores/setting.ts'
import { usePlayBeep, usePlayKeyboardAudio, usePlayWordAudio } from '@/core/hooks/sound.ts'
import { emitter, EventKey } from '@/core/utils/eventBus.ts'
import { _nextTick } from '@/core/utils/index.ts'
import { PracticeArticleWordType, PracticeType } from '@/core/types/enum.ts'
import type { ArticleWord, Sentence } from '@/core/types/types.ts'
import { lookupWord } from '@/core/hooks/useWordLookup.ts'
import { VolumeIcon } from '@/base'

interface IProps {
  /** 要练习的句子 */
  sentence: Sentence
  /** 是否激活键盘监听 */
  active?: boolean
  /** 需要高亮标注的词列表 */
  highlightWords?: string[]
  /** 高亮单词遮罩 */
  isHighlightWordsMask?: boolean
  nameList?: string[]
  mode?: PracticeType
  showPlayButton?: boolean
  isPractice?: boolean
  play?: Function<any, any>
  index?: string
}

const props = withDefaults(defineProps<IProps>(), {
  active: true,
  highlightWords: () => [],
  isHighlightWordsMask: false,
  showPlayButton: false,
  isPractice: false,
  mode: PracticeType.FollowWrite,
})

const emit = defineEmits<{
  /** 句子输入完成 */
  complete: [text: string]
  /** 输入错误 */
  wrong: [word: ArticleWord]
  /** 词点击 */
  wordClick: [{ wordText: string; event: MouseEvent }]
  /** 右键菜单 */
  contextMenu: [{ event: MouseEvent; word: ArticleWord; wordIndex: number }]
}>()

const settingStore = useSettingStore()
const playBeep = usePlayBeep()
const playKeyboardAudio = usePlayKeyboardAudio()

// ============ 核心状态 ============

let rootRef = $ref<HTMLDivElement>()
let wordIndex = $ref(0)
let stringIndex = $ref(0)
let input = $ref('')
let isSpace = $ref(false)
let isEnd = $ref(false)
let isTyping = false

let cursor = $ref({ top: 0, left: 0 })

let words = $computed(() => props.sentence.words ?? [])

let currentWord = $computed(() => words[wordIndex] ?? null)

function compareText(a: string, b: string) {
  return settingStore.ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b
}

function isCurrent(w: number) {
  return w === wordIndex
}

function isWrote(w: number) {
  return wordIndex > w || (wordIndex === w && stringIndex >= (words[w]?.word.length ?? 0))
}

function isSkippableWord(word?: ArticleWord | null) {
  return (
    !!word &&
    settingStore.ignoreSymbol &&
    [PracticeArticleWordType.Symbol, PracticeArticleWordType.Number].includes(word.type)
  )
}

// ============ 补全已输入词 ============

function fillPreviousInputs(endIndex: number) {
  for (let i = 0; i < endIndex; i++) {
    const w = words[i]
    if (w) {
      w.input = (w.input ?? '') + w.word.slice(w.input?.length ?? 0)
    }
  }
}

const normalize = (s: string) => s.toLowerCase().trim()
const namePatterns = $computed(() => {
  return Array.from(
    new Set(
      (props?.nameList ?? [])
        .map(normalize)
        .filter(Boolean)
        .map(s => s.split(/\s+/).filter(Boolean))
        .flat()
        .concat(['Mr', 'Mrs', 'Ms', 'Dr', 'Miss'].map(normalize))
    )
  )
})

const isNameWord = () => {
  let w: ArticleWord = words[wordIndex]
  return w?.type === PracticeArticleWordType.Word && namePatterns.length > 0 && namePatterns.includes(normalize(w.word))
}

// ============ 句子内词间前进 ============

function next() {
  isSpace = false
  input = ''
  stringIndex = 0

  if (wordIndex + 1 < words.length) {
    wordIndex++
    fillPreviousInputs(wordIndex)
    // 跳过符号和数字
    if (isSkippableWord(currentWord)) {
      next()
    } else if (isNameWord()) {
      next()
    }
  } else {
    finish()
  }
}

// ============ 句子完成 ============

function finish() {
  if (isEnd) return
  // 补全所有未输入完的词
  words.forEach(w => {
    w.input = (w.input ?? '') + w.word.slice(w.input?.length ?? 0)
  })
  isSpace = false
  input = ''
  //用于将最后一个单词标记为wrote，因为最后一个单词可能是数字或符号，会被直接跳过
  stringIndex = words.at(-1).word.length
  isEnd = true
  emit('complete', words.map(v => v.input).join(' '))
}

// ============ 键盘输入 ============

function onTyping(e: KeyboardEvent) {
  if (e.code === 'Backspace') {
    del()
    e.preventDefault()
    return
  }
  if (!words.length || isTyping || isEnd) return
  isTyping = true

  try {
    const word = currentWord
    if (!word) return finish()

    // 等空格状态
    if (isSpace) {
      if (e.code === 'Space') {
        next()
      } else {
        // 如果在第一个单词的最后一位上， 不按空格的直接输入下一个字母的话
        next()
        isTyping = false
        onTyping(e)
        return
      }
    }
    // 正常逐字符输入
    else {
      const letter = e.key
      const targetChar = word.word[stringIndex] ?? ''
      const isRight = compareText(letter, targetChar)

      if (!isRight) {
        reportWrong(word)
        playBeep()
      }

      input += letter
      word.input = input
      stringIndex++

      // 当前词输入完毕
      if (!word.word[stringIndex]) {
        input = ''
        if (word.nextSpace) {
          isSpace = true
        } else {
          next()
        }
      }
    }
    playKeyboardAudio()
    e.preventDefault()
  } finally {
    isTyping = false
  }
}

function reportWrong(word: ArticleWord) {
  if (word.type !== PracticeArticleWordType.Word) return
  emit('wrong', word)
}

// ============ 删除 ============

function findPrevTypeableIndex(fromIndex: number) {
  for (let i = fromIndex; i >= 0; i--) {
    if (!isSkippableWord(words[i])) return i
  }
  return -1
}

function del() {
  playKeyboardAudio()
  if (isEnd) return
  if (isSpace) isSpace = false
  let word = currentWord
  // 跨词删除：当前词已退到开头，回退到前一个词
  if (stringIndex === 0) {
    const prevIndex = findPrevTypeableIndex(wordIndex - 1)
    // 到达句首，无法继续回退
    if (prevIndex < 0) return
    wordIndex = prevIndex
    word = words[prevIndex]
    if (word.nextSpace) {
      isSpace = true
      stringIndex = word.word.length
    } else {
      stringIndex = Math.max(word.word.length - 1, 0)
    }
  } else {
    stringIndex--
  }
  input = word.input = word.input.slice(0, stringIndex)
}

// ============ 光标定位 ============

function checkCursorPosition() {
  _nextTick(() => {
    if (!rootRef || isEnd) return
    const currentWordEl = rootRef.querySelector('.word.is-current')
    if (!currentWordEl) return
    // 优先定位到 .segment-rest（未输入部分），其次 .word-end
    const restEl = currentWordEl.querySelector('.segment-rest') || currentWordEl.querySelector('.word-end')
    if (!restEl) return
    const rootRect = rootRef.getBoundingClientRect()
    const restRect = restEl.getBoundingClientRect()
    cursor = {
      top: restRect.top - rootRect.top,
      left: restRect.left - rootRect.left,
    }
  })
}

watch([() => wordIndex, () => stringIndex, () => isEnd, () => props.active], () => checkCursorPosition())

// ============ 悬停高亮 ============

let hoverIdx = $ref(-1)

function showSentence(w: number) {
  hoverIdx = w
}

function hideSentence() {
  hoverIdx = -1
}

// ============ 重置 ============

function reset() {
  wordIndex = 0
  stringIndex = 0
  input = ''
  isSpace = false
  isEnd = false
  hoverIdx = -1
  props.sentence.words?.forEach(w => {
    w.input = ''
  })
  nextTick(() => {
    if (isSkippableWord(currentWord)) {
      next()
    } else {
      checkCursorPosition()
    }
  })
}

watch(
  () => props.sentence,
  () => reset(),
  { immediate: true }
)

// ============ 键盘事件 ============

function handleTyping(e: KeyboardEvent) {
  if (!props.active) return
  onTyping(e)
}

function handleResetWord() {
  input = ''
}

watch(
  () => props.active,
  active => {
    emitter.off(EventKey.onTyping, handleTyping)
    emitter.off(EventKey.resetWord, handleResetWord)
    if (active) {
      props?.play?.(props.sentence, null)
      emitter.on(EventKey.onTyping, handleTyping)
      emitter.on(EventKey.resetWord, handleResetWord)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  emitter.off(EventKey.onTyping, handleTyping)
  emitter.off(EventKey.resetWord, handleResetWord)
})

// ============ Expose ============

defineExpose({
  reset,
  del,
  onTyping,
  isEnd,
  wordIndex,
  currentWord,
})
const playWordAudio = usePlayWordAudio()

function onWordClick(e: MouseEvent, word: ArticleWord) {
  lookupWord(e, word.word, playWordAudio)
}

function getWordIsDictation(word: ArticleWord, index: number) {
  if (
    isCurrent(index) &&
    !isSpace &&
    props.highlightWords.includes(word.word.toLowerCase()) &&
    props.isHighlightWordsMask &&
    props.active
  ) {
    return true
  }
  return props.mode === PracticeType.Dictation
}

let isPlaying = $ref(false)
function play() {
  isPlaying = true
  props?.play?.(props.sentence, () => {
    isPlaying = false
  })
}
</script>

<template>
  <span ref="rootRef" class="sentence-item en" :class="{ isPractice, isPlaying }">
    <span class="sentence">
      <span
        v-for="(word, w) in words"
        :key="w"
        class="word"
        :class="[isWrote(w) && 'wrote', isCurrent(w) && 'is-current', `word-${index}-${w}`]"
        @contextmenu.prevent="emit('contextMenu', { event: $event, word, wordIndex: w })"
      >
        <span
          class="word-wrap"
          :class="[
            hoverIdx === w && 'hover-show',
            word.type === PracticeArticleWordType.Number && 'font-family text-xl',
          ]"
          @mouseenter="showSentence(w)"
          @mouseleave="hideSentence"
          @click.stop="onWordClick($event, word)"
        >
          <TypingArticleWord
            :is-dictation="getWordIsDictation(word, w)"
            :word="word"
            :is-typing="isCurrent(w) && !isSpace && active"
            :isHighLight="highlightWords.includes(word.word.toLowerCase())"
            :isHighlightWordsMask="isHighlightWordsMask"
          />
          <span class="border-bottom" v-if="getWordIsDictation(word, w)"></span>
        </span>
        <Space v-if="word.nextSpace" class="word-end" :is-wrong="false" :is-wait="isCurrent(w) && isSpace" />
      </span>
    </span>
    <VolumeIcon :simple="true" v-if="showPlayButton" class="mr-2" title="发音" :cb="play" />
    <div v-if="!isEnd && active" class="cursor" :style="{ top: cursor.top + 'px', left: cursor.left + 'px' }"></div>
  </span>
</template>

<style scoped lang="scss">
.wrote {
  color: grey;
}
.sentence-item {
  position: relative;
  //color: var(--color-article);
  font-family: var(--en-article-family);
  //font-size: 1.6rem;
  //line-height: 2;

  :deep(.word-space.wait) {
    width: 0.25rem;
  }

  &.isPlaying {
    border-radius: 5px;
    background: rgba(34, 197, 94, 0.7) !important;
    //background: rgba(124, 58, 237, 0.1) !important;
  }

  &.isPractice {
    :deep(.word-space.wait) {
      width: 0.6rem;
    }
  }
  .sentence {
    word-break: keep-all;
    word-wrap: break-word;
    white-space: pre-wrap;
    transition:
      color 0.3s ease,
      opacity 0.3s ease;
  }

  .wrote,
  .hover-show {
    :deep(.hide) {
      opacity: 1 !important;
    }

    .border-bottom {
      display: none !important;
    }
  }

  .hover-show {
    border-radius: 0.2rem;
    background: rgba(34, 197, 94, 0.7) !important;

    :deep(.hide) {
      opacity: 1 !important;
    }
    :deep(span) {
      color: black !important;
    }
  }

  .word {
    display: inline-block;
  }

  .word-wrap {
    position: relative;
    transition: background-color 0.3s;
    cursor: pointer;
  }

  .border-bottom {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    border-bottom: 2px solid var(--color-article);
    //display: none;
    transform: translateY(-0.2rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-sentence-item .sentence,
  .typing-sentence-item .word-wrap {
    transition-duration: 0.01ms;
  }
}
</style>
