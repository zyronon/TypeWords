<script setup lang="ts">
import type { Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { resetActiveWordPlayCount, usePlayBeep, usePlayCorrect, usePlayKeyboardAudio } from '@/core/hooks/sound.ts'
import { emitter, EventKey } from '@/core/utils/eventBus.ts'
import { onUnmounted, watch } from 'vue'
import Space from '@/components/article/Space.vue'
import { _nextTick, last } from '@/core/utils'
import { useOnKeyboardEventListener } from '@/core/hooks/event.ts'
import { Toast } from '@/base'
import { usePracticeWordTyping } from '@/core/composables/practice-words/usePracticeWordTyping.ts'

interface IProps {
  word: Word
  practiceType: WordPracticeType
  isWordMasked: boolean
  showWordResult: boolean
  showFullWord: boolean
  wordFontSize: number
  active?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  showWordResult: false,
  active: true,
  showFullWord: false,
  isWordMasked: false,
  wordFontSize: 48,
})

const emit = defineEmits<{
  'update:showWordResult': [value: boolean]
  complete: []
  wrong: []
  play: [trigger: WordPlayTrigger]
}>()

const settingStore = useSettingStore()
const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()

const typing = usePracticeWordTyping({
  getWord: () => props.word,
  getPracticeType: () => props.practiceType,
  getIsWordMasked: () => props.isWordMasked,
  getShowWordResult: () => props.showWordResult,
  getSettings: () => settingStore,
  setShowWordResult: value => emit('update:showWordResult', value),
  onComplete: () => emit('complete'),
  onWrong: () => emit('wrong'),
  onPlay: trigger => emit('play', trigger),
  onNotice: notice =>
    Toast.info($t(notice.type === 'delete-reinput' ? 'press_delete_reinput' : 'press_space_continue'), {
      duration: 2000,
    }),
  playBeep,
  playCorrect,
  playKeyboardAudio,
  resetWordPlayCount: resetActiveWordPlayCount,
})

const {
  input,
  wrong,
  wholeInputAttempt,
  inputLock,
  inputCharacterStates,
  isWordCorrect,
  typeCharacter,
  backspace,
  reset,
  setWordTestResult,
  clearDeferredTimers,
} = typing

const displayWord = $computed(() => props.word.word.slice(input.value.length + wrong.value.length))
let cursor = $ref({ top: 0, left: 0 })
const typingWordRef = $ref<HTMLDivElement>()

function onTyping(event: KeyboardEvent) {
  if (event.code === 'Backspace') {
    backspace()
    return
  }
  typeCharacter({ key: event.key, code: event.code, shiftKey: event.shiftKey })
}

function checkCursorPosition() {
  _nextTick(() => {
    if (!typingWordRef) return
    const typingWordRect = typingWordRef.getBoundingClientRect()
    const inputList = typingWordRef.querySelectorAll('.l')
    if (inputList.length) {
      const inputRect = last(Array.from(inputList)).getBoundingClientRect()
      cursor = {
        top: inputRect.top - typingWordRect.top,
        left: inputRect.right - typingWordRect.left,
      }
      return
    }
    const element = typingWordRef.querySelector('.dictation') ?? typingWordRef.querySelector('.letter')
    const rect = element?.getBoundingClientRect()
    if (!rect) return
    cursor = {
      top: rect.top - typingWordRect.top,
      left: rect.left - typingWordRect.left,
    }
  })
}

function resetTypingCore(trigger: WordPlayTrigger) {
  reset(trigger)
  checkCursorPosition()
}

function onResetWord() {
  resetTypingCore(WordPlayTrigger.ResetSameWord)
}

useOnKeyboardEventListener(
  () => {},
  () => {}
)

watch(
  () => props.word,
  () => resetTypingCore(WordPlayTrigger.NewWord),
  { immediate: true }
)

watch([input, () => props.showFullWord, () => props.practiceType], checkCursorPosition)

function deactivate() {
  clearDeferredTimers()
  emitter.off(EventKey.resetWord, onResetWord)
  emitter.off(EventKey.onTyping, onTyping)
}

watch(
  () => props.active,
  active => {
    deactivate()
    if (active) {
      emitter.on(EventKey.resetWord, onResetWord)
      emitter.on(EventKey.onTyping, onTyping)
      checkCursorPosition()
    }
  },
  { immediate: true }
)

onUnmounted(deactivate)

defineExpose({
  isWordRight: () => isWordCorrect.value,
  setWordTestResult,
})
</script>

<template>
  <div
    class="typing-core"
    ref="typingWordRef"
    :class="wrong || (wholeInputAttempt && inputLock && !isWordCorrect) ? 'is-wrong' : ''"
  >
    <!-- 默写模式 -->
    <div v-if="practiceType === WordPracticeType.Dictation">
      <div
        class="letter text-align-center w-full inline-block"
        v-opacity:noAnim="!isWordMasked || showWordResult || showFullWord"
      >
        {{ word.word }}
      </div>
      <div
        class="mt-2 min-w-120 pb-1 dictation"
        :style="{ minHeight: wordFontSize + 'px' }"
        :class="showWordResult ? (isWordCorrect ? 'right' : 'wrong') : ''"
      >
        <template v-for="i in input">
          <span class="l" v-if="i !== ' '">{{ i }}</span>
          <Space class="l" v-else :is-wrong="showWordResult ? !isWordCorrect : false" :is-wait="!showWordResult" />
        </template>
      </div>
    </div>

    <!-- 非默写模式 -->
    <template v-else>
      <template v-if="wholeInputAttempt">
        <template v-for="(item, index) in inputCharacterStates" :key="index">
          <span v-if="item.character === ' '" class="l">
            <Space :is-wrong="!item.isCorrect" :is-wait="false" />
          </span>
          <span v-else class="l" :class="item.isCorrect ? 'input' : 'wrong'">{{ item.character }}</span>
        </template>
      </template>
      <span class="input" v-else-if="input">{{ input }}</span>
      <span class="wrong" v-if="wrong">{{ wrong }}</span>
      <span class="letter" v-if="isWordMasked && !showFullWord">
        {{
          displayWord
            .split('')
            .map(v => (v === ' ' ? '&nbsp;' : '_'))
            .join('')
        }}
      </span>
      <span class="letter" v-else>{{ displayWord }}</span>
    </template>

    <div
      v-if="active"
      class="cursor"
      :style="{
        top: cursor.top + 'px',
        left: cursor.left + 'px',
        height: wordFontSize + 'px',
      }"
    ></div>
  </div>
</template>

<style scoped lang="scss">
.dictation {
  border-bottom: 2px solid gray;
}

.typing-core {
  position: relative;

  &.is-wrong {
    animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  .input,
  .right {
    color: rgb(22, 163, 74);
  }

  .wrong {
    color: rgba(red, 0.6);
  }
}
</style>
