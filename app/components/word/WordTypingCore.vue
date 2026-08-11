<script setup lang="ts">
/**
 * WordTypingCore — 纯键入引擎
 *
 * 负责：
 * - 键入状态管理（input / wrong / inputLock / ...）
 * - 键盘事件处理（onTyping / del）
 * - 单词完成/错误/重复逻辑
 * - 光标准确定位
 *
 * 不负责：
 * - 音标/翻译/例句等元信息展示 → WordMetaPanel
 * - 自测/WordTest UI → WordIdentifyPanel
 * - 笔记/收藏/操作按钮 → TypeWord 壳
 */
import type { Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { resetActiveWordPlayCount, usePlayBeep, usePlayCorrect, usePlayKeyboardAudio } from '@/core/hooks/sound.ts'
import { emitter, EventKey } from '@/core/utils/eventBus.ts'
import { onUnmounted, watch } from 'vue'
import Space from '@/components/article/Space.vue'
import { _nextTick, last, normalizeWord } from '@/core/utils'
import { useOnKeyboardEventListener } from '@/core/hooks/event.ts'
import { Toast } from '@/base'
import {
  getPracticeInputCharacterStates,
  getWholeInputAfterWrongBackspace,
  isPracticeCharacterCorrect,
  isWholePracticeInputComplete,
  isWholePracticeInputCorrect,
  normalizePracticeInputCharacter,
} from '@/core/composables/practice-words/visible-word-typing.ts'

interface IProps {
  word: Word
  /** 当前 Cursor 解析出的真实练习类型。 */
  practiceType: WordPracticeType
  /** 当前单词及元信息是否处于遮罩状态，只影响画面。 */
  isWordMasked: boolean
  showWordResult: boolean
  showFullWord: boolean
  /** 当前单词字体大小 */
  wordFontSize: number
  /** 是否激活键盘监听 */
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

// ============ 键入状态 ============
let input = $ref('')
let wrong = $ref('')
let wholeInputAttempt = $ref<boolean | null>(null)
let inputLock = false
let wordRepeatCount = 0
let wordCompletedTime = 0
let jumpTimer: ReturnType<typeof setTimeout> | null = null
let repeatTimer: ReturnType<typeof setTimeout> | null = null
let wrongClearTimer: ReturnType<typeof setTimeout> | null = null
let pressNumber = 0
let cursor = $ref({
  top: 0,
  left: 0,
})

const typingWordRef = $ref<HTMLDivElement>()

function emitShowWordResult(val: boolean) {
  emit('update:showWordResult', val)
}

let displayWord = $computed(() => {
  return props.word.word.slice(input.length + wrong.length)
})

const inputCharacterStates = $computed(() => {
  return getPracticeInputCharacterStates(input, props.word.word, settingStore.ignoreCase)
})

const isWordCorrect = $computed(() => {
  let a = input
  let b = props.word.word
  if (props.practiceType === WordPracticeType.Dictation) {
    a = normalizeWord(a)
    b = normalizeWord(b)
  }
  return isWholePracticeInputCorrect(a, b, settingStore.ignoreCase)
})

function clearJumpTimer() {
  if (!jumpTimer) {
    return
  }
  clearTimeout(jumpTimer)
  jumpTimer = null
}

function clearDeferredTimers() {
  clearJumpTimer()
  if (repeatTimer) clearTimeout(repeatTimer)
  if (wrongClearTimer) clearTimeout(wrongClearTimer)
  repeatTimer = null
  wrongClearTimer = null
}

function typo(needPlay: boolean = true) {
  emit('wrong')
  needPlay && emit('play', WordPlayTrigger.Typo)
}

function shouldRepeat() {
  if (props.practiceType === WordPracticeType.FollowWrite) {
    if (settingStore.repeatCount == 100) {
      return settingStore.repeatCustomCount > wordRepeatCount + 1
    } else {
      return settingStore.repeatCount > wordRepeatCount + 1
    }
  } else {
    return false
  }
}

function repeat() {
  if (repeatTimer) clearTimeout(repeatTimer)
  const wordKey = props.word.word
  repeatTimer = setTimeout(() => {
    repeatTimer = null
    if (props.word.word !== wordKey) return
    wrong = input = ''
    wholeInputAttempt = null
    wordRepeatCount++
    inputLock = false
    emit('play', WordPlayTrigger.RepeatWord)
  }, settingStore.waitTimeForChangeWord)
}

function completeCurrentInput() {
  wordCompletedTime = Date.now()
  playCorrect()
  if ([WordPracticeType.Listen].includes(props.practiceType) && !props.showWordResult) {
    emitShowWordResult(true)
  }
  if ([WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(props.practiceType)) {
    if (settingStore.autoNextWord) {
      completeTypeWord(true)
    }
  }
}

// ============ 核心键入逻辑 ============
function completeTypeWord(delay: boolean) {
  if (shouldRepeat()) {
    repeat()
  } else {
    if (delay) {
      clearJumpTimer()
      const wordKey = props.word.word
      jumpTimer = setTimeout(() => {
        jumpTimer = null
        if (props.word.word === wordKey) emit('complete')
      }, settingStore.waitTimeForChangeWord)
    } else {
      emit('complete')
    }
  }
}

const isSpace = (e: KeyboardEvent) => e.code === 'Space'

async function onTyping(e: KeyboardEvent) {
  // console.log('onTyping',e)
  if (e.code === 'Backspace') return del()
  // debugger

  const target = props.word.word
  // 输入完成会锁死不能再输入
  if (inputLock) {
    if (wholeInputAttempt && !isWordCorrect) {
      Toast.info($t('press_delete_reinput'), { duration: 2000 })
      return
    }
    //判断是否是空格键以便切换到下一个
    if (isSpace(e)) {
      //正确时就切换到下一个
      if (isWordCorrect) {
        clearJumpTimer()
        // 如果单词刚完成（300ms内），忽略空格键，避免同时按下最后一个字母和空格键时跳过
        // 手动模式使用独立的空格冷却时间设置
        const spaceCooldown = settingStore.autoNextWord
          ? settingStore.waitTimeForChangeWord
          : settingStore.spaceCooldownTime
        if (wordCompletedTime && Date.now() - wordCompletedTime < spaceCooldown) {
          return
        }
        completeTypeWord(false)
        inputLock = false
      } else {
        if (props.showWordResult) {
          // 错误时，提示用户按删除键，仅默写需要提示
          pressNumber++
          if (pressNumber >= 3) {
            Toast.info($t('press_delete_reinput'), { duration: 2000 })
            pressNumber = 0
          }
        }
      }
    } else {
      //当正确时，提醒用户按空格键切下一个
      if (isWordCorrect) {
        pressNumber++
        if (pressNumber >= 3) {
          Toast.info($t('press_space_continue'), { duration: 2000 })
          pressNumber = 0
        }
      } else {
        //当错误时，按任意键重新输入
        emitShowWordResult(false)
        inputLock = false
        input = wrong = ''
        onTyping(e)
      }
    }
    return
  }

  inputLock = true
  let letter = e.key
  //默写特殊逻辑
  if (props.practiceType === WordPracticeType.Dictation) {
    if (isSpace(e)) {
      //如果输入长度大于单词长度/单词不包含空格，并且输入不为空（开始直接输入空格不行），则显示单词；
      if (input.length && (input.length >= target.length || !target.includes(' '))) {
        //比对是否一致
        if (isWordCorrect) {
          //如果已显示单词，则发射完成事件，并 return
          if (props.showWordResult) {
            return emit('complete')
          } else {
            //未显示单词，则播放正确音乐，并在后面设置为 showWordResult.value 为 true 来显示单词
            emitShowWordResult(true)
            playCorrect()
            emit('play', WordPlayTrigger.DictationReveal)
          }
        } else {
          //错误处理
          playBeep()
          emitShowWordResult(true)
          typo()
        }
        return
      }
    }
    //默写途中不判断是否正确，在按空格再判断
    input += letter
    wrong = ''
    playKeyboardAudio()
    inputLock = false
  } else {
    if (props.practiceType === WordPracticeType.Identify && !props.showWordResult) {
      // emit 更新父组件 prop 不是同步的，不能递归调用 onTyping，否则会反复进入此分支。
      // 标记为不认识后，当前按键直接继续走下面的正常键入逻辑。
      emitShowWordResult(true)
      //不发音
      typo(false)
    }

    if (wholeInputAttempt === null) {
      wholeInputAttempt = settingStore.visibleWordWholeInput && !props.isWordMasked
    }

    const targetCharacter = target[input.length]
    const letter = normalizePracticeInputCharacter(e, targetCharacter)

    if (wholeInputAttempt) {
      input += letter
      wrong = ''
      playKeyboardAudio()

      if (isWholePracticeInputComplete(input, target)) {
        if (isWholePracticeInputCorrect(input, target, settingStore.ignoreCase)) {
          completeCurrentInput()
        } else {
          playBeep()
          emit('play', WordPlayTrigger.Typo)
        }
      } else {
        inputLock = false
      }
      return
    }

    const isKeyRight = isPracticeCharacterCorrect(letter, targetCharacter, settingStore.ignoreCase)

    if (isKeyRight) {
      input += letter
      wrong = ''
      playKeyboardAudio()
    } else {
      playBeep()
      typo()
      wrong = letter
      if (wrongClearTimer) clearTimeout(wrongClearTimer)
      const wordKey = props.word.word
      wrongClearTimer = setTimeout(() => {
        wrongClearTimer = null
        if (props.word.word !== wordKey) return
        if (settingStore.inputWrongClear) input = ''
        wrong = ''
        if (!input) wholeInputAttempt = null
      }, 500)
    }

    //不需要把inputLock设为false，输入完成不能再输入了，只能删除，删除会打开锁
    if (isWordCorrect) {
      completeCurrentInput()
    } else {
      inputLock = false
    }
  }
}

function del() {
  playKeyboardAudio()
  inputLock = false
  if (props.practiceType === WordPracticeType.Dictation && props.showWordResult) {
    input = wrong = ''
  } else {
    if (wrong) {
      wrong = ''
    } else {
      input = input.slice(0, -1)
    }
  }
  if (!input) {
    //自测时，清空了输入则显示专属ui
    emitShowWordResult(false)
    wholeInputAttempt = null
  }
}

// ============ 重置状态 ============
function resetTypingCore(trigger: WordPlayTrigger) {
  clearDeferredTimers()
  wrong = input = ''
  wholeInputAttempt = null
  wordRepeatCount = 0
  inputLock = false
  wordCompletedTime = 0
  resetActiveWordPlayCount(props.word.word)
  if (props.practiceType !== WordPracticeType.Dictation) {
    emit('play', trigger)
  }
  checkCursorPosition()
}

function onResetWord() {
  resetTypingCore(WordPlayTrigger.ResetSameWord)
}

// ============ 光标定位 ============
function checkCursorPosition() {
  _nextTick(() => {
    if (!typingWordRef) return
    const typingWordRect = typingWordRef.getBoundingClientRect()
    const inputList = typingWordRef?.querySelectorAll(`.l`) ?? []
    if (inputList.length) {
      let inputRect = last(Array.from(inputList)).getBoundingClientRect()
      cursor = {
        top: inputRect.top - typingWordRect.top,
        left: inputRect.right - typingWordRect.left,
      }
    } else {
      let dom
      const dictation = typingWordRef.querySelector(`.dictation`)
      if (dictation) dom = dictation
      else {
        dom = typingWordRef.querySelector(`.letter`)
      }
      let elRect = dom?.getBoundingClientRect()
      if (!elRect) return
      cursor = {
        top: elRect.top - typingWordRect.top,
        left: elRect.left - typingWordRect.left,
      }
    }
  })
}

// ============ 键盘事件 ============

function onKeyDown(e: KeyboardEvent) {}

function onKeyUp(_e: KeyboardEvent) {
  // hideWord 由父组件处理
}

useOnKeyboardEventListener(onKeyDown, onKeyUp)

watch(
  () => props.word,
  () => resetTypingCore(WordPlayTrigger.NewWord),
  { immediate: true }
)

watch([() => input, () => props.showFullWord, () => props.practiceType], () => {
  checkCursorPosition()
})

function unmounted() {
  clearDeferredTimers()
  emitter.off(EventKey.resetWord, onResetWord)
  emitter.off(EventKey.onTyping, onTyping)
}

watch(
  () => props.active,
  active => {
    unmounted()
    if (active) {
      emitter.on(EventKey.resetWord, onResetWord)
      emitter.on(EventKey.onTyping, onTyping)
      checkCursorPosition()
    }
  },
  { immediate: true }
)

onUnmounted(unmounted)

/** WordTest 选择后设置结果 */
function setWordTestResult(isCorrect: boolean, wordStr: string) {
  if (isCorrect) {
    inputLock = true
    input = wordStr
    playCorrect()
  } else {
    wrong = wordStr
    playBeep()
  }
}

defineExpose({
  isWordRight: () => isWordCorrect,
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
