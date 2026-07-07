<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { VolumeIcon } from '@typewords/base'
import { useOnKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import { parseSentence } from '@typewords/core/hooks/article.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { usePlayBeep, usePlayCorrect, usePlayKeyboardAudio } from '@typewords/core/hooks/sound.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { PracticeArticleWordType } from '@typewords/core/types/enum.ts'
import type { ArticleWord } from '@typewords/core/types/types.ts'
import Space from '@typewords/core/components/article/Space.vue'

interface IProps {
  /** 要练习的文本（单句或段落） */
  text: string
  /** 练习模式 */
  mode?: 'followWrite' | 'dictation' | 'listen'
  /** 是否激活键盘监听 */
  active?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  text: '',
  mode: 'followWrite',
  active: true,
})

const emit = defineEmits<{
  complete: []
  wrong: []
  play: []
  change: []
}>()

const settingStore = useSettingStore()
const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()

// ============ 状态（直接定义在组件中，不通过 composable） ============

const words = ref<ArticleWord[]>([])
const wordIndex = ref(0)
const stringIndex = ref(0)
const input = ref('')
const wrong = ref('')
const isSpace = ref(false)
const isEnd = ref(false)
const cursor = ref({ top: 0, left: 0 })
let isTyping = false
let wrongReported = false

const sentenceLineRef = ref<HTMLDivElement>()

const currentWord = computed(() => words.value[wordIndex.value] ?? null)

const showEnglishTokens = computed(() => props.mode === 'followWrite' || (isEnd.value && props.mode !== 'followWrite'))
const hideRest = computed(() => !showEnglishTokens.value)

function compareText(a: string, b: string) {
  return settingStore.ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b
}

function isSkippableWord(word?: ArticleWord | null) {
  return !!word && settingStore.ignoreSymbol && [PracticeArticleWordType.Symbol, PracticeArticleWordType.Number].includes(word.type)
}

// ============ 重置 ============

function reset() {
  if (!props.text) {
    words.value = []
    return
  }
  words.value = parseSentence(props.text)
  // 重置所有词的 input
  words.value.forEach(w => { w.input = '' })
  wordIndex.value = 0
  stringIndex.value = 0
  input.value = ''
  wrong.value = ''
  isSpace.value = false
  isEnd.value = false
  wrongReported = false

  // 跳过开头符号
  if (isSkippableWord(currentWord.value)) {
    moveToNextWord()
  }
}

watch(() => props.text, () => reset(), { immediate: true })

// ============ 补全历史词 ============

function fillPreviousInputs(endIndex: number) {
  for (let i = 0; i < endIndex; i++) {
    const w = words.value[i]
    w.input = (w.input ?? '') + w.word.slice(w.input?.length ?? 0)
  }
}

// ============ 推进到下个词 ============

function moveToNextWord() {
  isSpace.value = false
  input.value = ''
  wrong.value = ''
  stringIndex.value = 0
  wrongReported = false

  if (wordIndex.value + 1 < words.value.length) {
    wordIndex.value++
    fillPreviousInputs(wordIndex.value)
    if (isSkippableWord(currentWord.value)) {
      moveToNextWord()
    }
  } else {
    finish()
  }
}

// ============ 完成 ============

function finish() {
  if (isEnd.value) return
  // 补全所有未输入完的词
  words.value.forEach(w => {
    w.input = (w.input ?? '') + w.word.slice(w.input?.length ?? 0)
  })
  input.value = ''
  wrong.value = ''
  stringIndex.value = 0
  isSpace.value = false
  isEnd.value = true
  if (isAllRight()) playCorrect()
  emit('complete')
  emitChange()
}

function isAllRight() {
  return words.value.every(w => isSkippableWord(w) || compareText(w.input ?? '', w.word))
}

// ============ 输入处理 ============

function onTyping(e: KeyboardEvent) {
  if (!words.value.length || isTyping || isEnd.value) return
  isTyping = true

  try {
    const word = currentWord.value
    if (!word) {
      finish()
      return
    }

    wrong.value = ''

    // 等空格状态
    if (isSpace.value) {
      if (e.code === 'Space') {
        moveToNextWord()
      } else {
        moveToNextWord()
        isTyping = false
        onTyping(e)
        return
      }
    }
    // 正常逐字符输入
    else {
      const targetChar = word.word[stringIndex.value] ?? ''
      const letter = e.key

      if (!letter || letter.length > 1) {
        isTyping = false
        return
      }

      const isRight = compareText(letter, targetChar)
      if (!isRight) {
        wrong.value = letter
        reportWrong(word)
        playBeep()
      }

      input.value += letter
      word.input = input.value
      stringIndex.value++

      // 当前词输入完毕
      if (!word.word[stringIndex.value]) {
        input.value = ''
        if (word.nextSpace) {
          isSpace.value = true
        } else {
          moveToNextWord()
        }
      }
    }

    playKeyboardAudio()
    emitChange()
    e.preventDefault()
  } finally {
    isTyping = false
  }
}

function reportWrong(word: ArticleWord) {
  if (word.type !== PracticeArticleWordType.Word) return
  if (wrongReported) return
  wrongReported = true
  emit('wrong')
}

// ============ 删除 ============

function findPrevTypeableIndex(fromIndex: number) {
  for (let i = fromIndex; i >= 0; i--) {
    if (!isSkippableWord(words.value[i])) return i
  }
  return -1
}

function del() {
  if (!words.value.length) return
  playKeyboardAudio()

  // 先清除 wrong 状态（但不 return，继续执行删除逻辑）
  if (wrong.value) {
    wrong.value = ''
  }

  // isEnd 回退：从完成态退回到最后一个词
  if (isEnd.value) {
    isEnd.value = false
    const prevIndex = findPrevTypeableIndex(words.value.length - 1)
    if (prevIndex < 0) return
    const prevWord = words.value[prevIndex]
    wordIndex.value = prevIndex
    isSpace.value = false
    stringIndex.value = Math.max(prevWord.word.length - 1, 0)
    prevWord.input = prevWord.input.slice(0, stringIndex.value)
    input.value = prevWord.input
    wrongReported = false
    emitChange()
    return
  }

  // 清除 isSpace 状态
  if (isSpace.value) {
    isSpace.value = false
  }

  let word = currentWord.value
  if (!word) return

  // 跨词删除
  if (stringIndex.value === 0) {
    const prevIndex = findPrevTypeableIndex(wordIndex.value - 1)
    if (prevIndex < 0) return
    wordIndex.value = prevIndex
    word = words.value[prevIndex]
    if (word.nextSpace) {
      isSpace.value = true
      stringIndex.value = word.word.length
    } else {
      stringIndex.value = Math.max(word.word.length - 1, 0)
    }
    wrongReported = false
  } else {
    stringIndex.value--
  }

  word.input = word.input.slice(0, stringIndex.value)
  input.value = word.input
  emitChange()
}

// ============ 光标 ============

function checkCursorPosition() {
  nextTick(() => {
    if (!sentenceLineRef.value || isEnd.value) return
    // 定位到当前词的第一个未输入字符（.segment-rest）
    const currentWordEl = sentenceLineRef.value.querySelector('.word.is-current')
    if (!currentWordEl) return
    const restEl = currentWordEl.querySelector('.segment-rest') as HTMLElement | null
    if (!restEl) return
    const lineRect = sentenceLineRef.value.getBoundingClientRect()
    const restRect = restEl.getBoundingClientRect()
    cursor.value = {
      top: restRect.top - lineRect.top,
      left: restRect.left - lineRect.left,
    }
  })
}

watch([wordIndex, stringIndex, isEnd], () => checkCursorPosition())
watch(() => props.text, () => { nextTick(() => checkCursorPosition()) })

// ============ 键盘事件 ============

function handleTyping(e: KeyboardEvent) {
  if (!props.active) return
  onTyping(e)
}

watch(
  () => props.active,
  active => {
    emitter.off(EventKey.onTyping, handleTyping)
    if (active) emitter.on(EventKey.onTyping, handleTyping)
  },
  { immediate: true }
)

onMounted(() => {
  nextTick(() => checkCursorPosition())
})

onUnmounted(() => {
  emitter.off(EventKey.onTyping, handleTyping)
})

function onKeyDown(e: KeyboardEvent) {
  if (!props.active) return
  if (e.key === 'Backspace') {
    del()
    e.preventDefault()
  }
}

useOnKeyboardEventListener(onKeyDown, () => {})

// ============ 分词渲染 ============

interface TokenSegment {
  type: 'input-right' | 'input-wrong' | 'word-end' | 'space'
  text: string
}

function getTokenSegments(word: ArticleWord): TokenSegment[] {
  const inp = word.input ?? ''
  const segments: TokenSegment[] = []

  if (inp.length && inp.length === word.word.length) {
    if (compareText(inp, word.word)) {
      segments.push({ type: 'word-end', text: inp })
      return segments
    }
  }

  let right = ''
  let wrong = ''

  for (let i = 0; i < inp.length; i++) {
    const ch = inp[i]
    if (ch === ' ') {
      right = ''
      wrong = ''
      segments.push({ type: 'space', text: ' ' })
    } else if (compareText(ch, word.word[i] ?? '')) {
      right += ch
      wrong = ''
      const last = segments[segments.length - 1]
      if (last?.type === 'input-right') {
        last.text = right
      } else {
        segments.push({ type: 'input-right', text: right })
      }
    } else {
      wrong += ch
      right = ''
      const last = segments[segments.length - 1]
      if (last?.type === 'input-wrong') {
        last.text = wrong
      } else {
        segments.push({ type: 'input-wrong', text: wrong })
      }
    }
  }

  if (inp.length < word.word.length) {
    segments.push({ type: 'word-end', text: word.word.slice(inp.length) })
  } else if (!inp.length) {
    segments.push({ type: 'word-end', text: word.word })
  }

  return segments
}

function isCurrentWord(idx: number) {
  return idx === wordIndex.value
}

// ============ expose ============

defineExpose({ reset, del })

function emitChange() {
  emit('change')
}

function play() {
  emit('play')
}
</script>

<template>
  <div class="sentence-practice" :class="{ inactive: !active }">
    <template v-if="text">
      <!-- 发音按钮 -->
      <div class="sentence-action">
        <VolumeIcon :simple="false" title="发音" :cb="play" />
      </div>

      <!-- 输入区域 -->
      <div class="sentence-line" ref="sentenceLineRef">
        <template v-for="(word, wordIdx) in words" :key="wordIdx">
          <!-- 词 -->
          <span
            class="word"
            :class="{
              'is-current': isCurrentWord(wordIdx),
              'is-space': isCurrentWord(wordIdx) && isSpace,
            }"
          >
            <template v-for="(seg, segIdx) in getTokenSegments(word)" :key="segIdx">
              <!-- 正确输入 -->
              <span v-if="seg.type === 'input-right'" class="segment-right">{{ seg.text }}</span>
              <!-- 错误输入（空格用 Space 组件渲染） -->
              <Space v-else-if="seg.type === 'space'" :is-wrong="true" />
              <!-- 错误输入（非空格） -->
              <span v-else-if="seg.type === 'input-wrong'" class="segment-wrong" :class="{ hide: hideRest }">{{ seg.text }}</span>
              <!-- 未输入部分 -->
              <span v-else class="segment-rest" :class="{ hide: hideRest }">{{ seg.text }}</span>
            </template>
          </span>
          <!-- 词间空格 -->
          <Space
            v-if="word.nextSpace"
            :is-wrong="false"
            :is-wait="isCurrentWord(wordIdx) && isSpace && !isEnd"
          />
        </template>
      </div>

      <!-- 光标 -->
      <div
        v-if="!isEnd"
        class="cursor"
        :style="{ top: cursor.top + 'px', left: cursor.left + 'px' }"
      ></div>
    </template>
    <div v-else class="empty-state">暂无可练习的句子</div>
  </div>
</template>

<style scoped lang="scss">
.sentence-practice {
  @apply relative w-full rounded-lg border border-item-solid bg-[var(--bg-card-primary)] px-4 py-5 md:px-5 md:py-6;
  color: var(--color-font-2);
  transition: opacity 0.2s ease, border-color 0.2s ease;

  &.inactive {
    opacity: 0.72;
  }
}

.sentence-action {
  @apply absolute right-3 top-3;
}

.sentence-line {
  @apply w-full pr-10 leading-relaxed text-2xl md:text-3xl;
  font-family: var(--en-article-family);
  letter-spacing: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
  position: relative;
}

.word {
  @apply inline rounded-md px-0.5 transition-colors duration-200;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;

  &.is-current {
    background: rgba(var(--color-select-bg-rgb, 34, 197, 94), 0.08);
  }
}

.segment-right {
  color: var(--color-select-bg);
}

.segment-wrong {
  @apply color-red;
}

.segment-rest {
  color: var(--color-font-2);
}

.hide {
  opacity: 0;
}

.cursor {
  position: absolute;
  width: 2px;
  background: var(--color-select-bg);
  animation: blink 1s step-end infinite;
  pointer-events: none;
  transition: top 0.05s ease, left 0.05s ease;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.empty-state {
  @apply min-h-30 center text-base;
  color: var(--color-font-1);
}

@media (max-width: 768px) {
  .sentence-practice {
    @apply px-3 py-4;
  }
}
</style>
