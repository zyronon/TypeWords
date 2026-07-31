<script setup lang="ts">
/**
 * WordTypingCoreV2 — 纯键入引擎
 *
 * 负责：
 * - 键入状态管理（input / wrong / inputLock / ...）
 * - 键盘事件处理（onTyping / del）
 * - 单词完成/错误/重复逻辑
 * - 光标准确定位
 *
 * 不负责：
 * - 音标/翻译/例句等元信息展示 → WordMetaPanelV2
 * - 自测/WordTest UI → WordIdentifyPanelV2
 * - 笔记/收藏/操作按钮 → TypeWordV2 壳
 */
import type { Word } from '@typewords/core/types/types.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import {
  cancelWordPracticeAudio,
  resetActiveWordPlayCount,
  usePlayBeep,
  usePlayCorrect,
  usePlayKeyboardAudio,
} from '@typewords/core/hooks/sound.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { onUnmounted, watch } from 'vue'
import Space from '@typewords/core/components/article/Space.vue'
import { _nextTick, last, normalizeWord } from '@typewords/core/utils'
import { useOnKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import { WordPlayTrigger } from '@typewords/core/composables/useWordPracticeAudio.ts'

interface IProps {
  word: Word
  /** 当前 Cursor 解析出的真实练习类型。 */
  practiceType: WordPracticeType
  /** 当前单词及元信息是否处于遮罩状态，只影响画面。 */
  isWordMasked: boolean
  showWordResult: boolean
  wrongTimes: number
  showFullWord: boolean
  /** 当前单词字体大小 */
  wordFontSize: number
  /** 是否激活键盘监听 */
  active?: boolean
  /** 外部注入的 playWord 函数 */
  playWord: (trigger: WordPlayTrigger) => void
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  showWordResult: false,
  wrongTimes: 0,
  active: true,
  showFullWord: false,
  isWordMasked: false,
  wordFontSize: 48,
})

const emit = defineEmits<{
  'update:showWordResult': [value: boolean]
  'update:wrongTimes': [value: number]
  complete: []
  wrong: []
}>()

const settingStore = useSettingStore()

const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()

// ============ 键入状态 ============
let input = $ref('')
let wrong = $ref('')
let inputLock = false
let waitClear = false
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

function emitWrongTimes(val: number) {
  emit('update:wrongTimes', val)
}

let displayWord = $computed(() => {
  return props.word.word.slice(input.length + wrong.length)
})

const isWordRight = $computed(() => {
  let a = input
  let b = props.word.word
  if (props.practiceType === WordPracticeType.Dictation) {
    a = normalizeWord(a)
    b = normalizeWord(b)
  }
  return settingStore.ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b
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

function typo() {
  emit('wrong')
  emitWrongTimes(props.wrongTimes + 1)
  props.playWord(WordPlayTrigger.Typo)
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
    wordRepeatCount++
    inputLock = false
    props.playWord(WordPlayTrigger.RepeatWord)
  }, settingStore.waitTimeForChangeWord)
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

function del() {
  playKeyboardAudio()
  inputLock = false
  waitClear = false
  if (props.showWordResult) {
    input = ''
    emitShowWordResult(false)
    //如果是自测阶段，按删除键代码弄错了，需要标记为错词，同时从excludeWords里排除
    if (props.practiceType === WordPracticeType.Identify) {
      typo()
    }
  } else {
    if (wrong) {
      wrong = ''
    } else {
      input = input.slice(0, -1)
    }
  }
}

const isSpace = (e: KeyboardEvent) => e.code === 'Space'

async function onTyping(e: KeyboardEvent) {
  if (e.code === 'Backspace') return del()
  // if (waitClear) return

  const target = props.word.word
  // 输入完成会锁死不能再输入
  if (inputLock) {
    //判断是否是空格键以便切换到下一个
    if (isSpace(e)) {
      //正确时就切换到下一个
      if (isWordRight) {
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
        emitShowWordResult(false)
        inputLock = false
      } else {
        if (props.showWordResult) {
          // 错误时，提示用户按删除键，仅默写需要提示
          pressNumber++
          if (pressNumber >= 3) {
            // Toast handled in parent shell
            pressNumber = 0
          }
        }
      }
    } else {
      //当正确时，提醒用户按空格键切下一个
      if (isWordRight) {
        pressNumber++
        if (pressNumber >= 3) {
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
        if (isWordRight) {
          //如果已显示单词，则发射完成事件，并 return
          if (props.showWordResult) {
            return emit('complete')
          } else {
            //未显示单词，则播放正确音乐，并在后面设置为 showWordResult.value 为 true 来显示单词
            emitShowWordResult(true)
            playCorrect()
            props.playWord(WordPlayTrigger.DictationReveal)
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
      typo()
    }

    let isKeyRight = false
    if (settingStore.ignoreCase) {
      isKeyRight = letter.toLowerCase() === target[input.length]?.toLowerCase()
    } else {
      isKeyRight = letter === target[input.length]
    }
    //针对中文的特殊判断
    if (
      e.shiftKey &&
      (('！' === target[input.length] && e.code === 'Digit1') ||
        ('￥' === target[input.length] && e.code === 'Digit4') ||
        ('…' === target[input.length] && e.code === 'Digit6') ||
        ('（' === target[input.length] && e.code === 'Digit9') ||
        ('—' === target[input.length] && e.code === 'Minus') ||
        ('？' === target[input.length] && e.code === 'Slash') ||
        ('》' === target[input.length] && e.code === 'Period') ||
        ('《' === target[input.length] && e.code === 'Comma') ||
        ('“' === target[input.length] && e.code === 'Quote') ||
        ('”' === target[input.length] && e.code === 'Quote') ||
        ('：' === target[input.length] && e.code === 'Semicolon') ||
        ('）' === target[input.length] && e.code === 'Digit0'))
    ) {
      isKeyRight = true
      letter = target[input.length]
    }
    if (
      !e.shiftKey &&
      (('、' === target[input.length] && e.code === 'Slash') ||
        ('。' === target[input.length] && e.code === 'Period') ||
        ('，' === target[input.length] && e.code === 'Comma') ||
        ('‘' === target[input.length] && e.code === 'Quote') ||
        ('’' === target[input.length] && e.code === 'Quote') ||
        ('；' === target[input.length] && e.code === 'Semicolon') ||
        ('【' === target[input.length] && e.code === 'BracketLeft') ||
        ('】' === target[input.length] && e.code === 'BracketRight'))
    ) {
      isKeyRight = true
      letter = target[input.length]
    }

    if (isKeyRight) {
      input += letter
      wrong = ''
      playKeyboardAudio()
    } else {
      playBeep()
      typo()
      wrong = letter
      waitClear = true
      if (wrongClearTimer) clearTimeout(wrongClearTimer)
      const wordKey = props.word.word
      wrongClearTimer = setTimeout(() => {
        wrongClearTimer = null
        if (props.word.word !== wordKey) return
        if (settingStore.inputWrongClear) input = ''
        wrong = ''
        waitClear = false
      }, 500)
    }

    //不需要把inputLock设为false，输入完成不能再输入了，只能删除，删除会打开锁
    if (isWordRight) {
      wordCompletedTime = Date.now() // 记录单词完成的时间戳
      playCorrect()
      if ([WordPracticeType.Listen, WordPracticeType.Identify].includes(props.practiceType) && !props.showWordResult) {
        emitShowWordResult(true)
      }
      if ([WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(props.practiceType)) {
        if (settingStore.autoNextWord) {
          completeTypeWord(true)
        }
      }
    } else {
      inputLock = false
    }
  }
}

// ============ 重置状态 ============
function resetTypingCore(trigger: WordPlayTrigger) {
  clearDeferredTimers()
  cancelWordPracticeAudio()
  wrong = input = ''
  waitClear = false
  wordRepeatCount = 0
  emitShowWordResult(false)
  inputLock = false
  wordCompletedTime = 0
  emitWrongTimes(0)
  resetActiveWordPlayCount(props.word.word)
  if (props.practiceType !== WordPracticeType.Dictation) {
    props.playWord(trigger)
  }
  checkCursorPosition()
}

function onResetWord() {
  resetTypingCore(WordPlayTrigger.ResetSameWord)
}

// ============ 光标定位 ============
function checkCursorPosition() {
  _nextTick(() => {
    let cursorOffset: { top: number; left: number }
    cursorOffset = { top: 0, left: -3 }
    // 选中目标元素
    const inputList = typingWordRef?.querySelectorAll(`.l`) ?? []
    if (!typingWordRef) return
    const typingWordRect = typingWordRef.getBoundingClientRect()
    const cursorHeight = props.wordFontSize

    if (inputList.length) {
      let inputRect = last(Array.from(inputList)).getBoundingClientRect()
      cursor = {
        top: inputRect.top + inputRect.height - cursorHeight - typingWordRect.top + cursorOffset.top,
        left: inputRect.right - typingWordRect.left + cursorOffset.left,
      }
    } else {
      const dictation = typingWordRef.querySelector(`.dictation`)
      let elRect: DOMRect | undefined
      if (dictation) {
        elRect = dictation.getBoundingClientRect()
      } else {
        const letter = typingWordRef.querySelector(`.letter`)
        elRect = letter?.getBoundingClientRect()
      }
      if (!elRect) return
      cursor = {
        top: elRect.top + elRect.height - cursorHeight - typingWordRect.top + cursorOffset.top,
        left: elRect.left - typingWordRect.left + cursorOffset.left,
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

// ============ 生命周期 ============

watch(
  () => props.word,
  () => resetTypingCore(WordPlayTrigger.NewWord)
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

// ============ 暴露给父组件 ============

/** 自测"认识"时调用：展示完整单词并锁定输入 */
function revealWord(wordStr: string) {
  inputLock = true
  input = wordStr
  emitShowWordResult(true)
}

/** WordTest 选择后设置结果 */
function setWordTestResult(isCorrect: boolean, wordStr: string) {
  if (isCorrect) {
    input = wordStr
    // correct sound handled by parent
  } else {
    wrong = wordStr
    // beep handled by parent
  }
}

defineExpose({
  right: isWordRight,
  revealWord,
  setWordTestResult,
})
</script>

<template>
  <div class="typing-core" ref="typingWordRef" :class="wrong ? 'is-wrong' : ''">
    <!-- 默写模式 -->
    <div v-if="practiceType === WordPracticeType.Dictation">
      <div
        class="letter text-align-center w-full inline-block"
        v-opacity:noAnim="!isWordMasked || showWordResult || showFullWord"
      >
        {{ word.word }}
      </div>
      <div
        class="mt-2 w-120 dictation"
        :style="{ minHeight: wordFontSize + 'px' }"
        :class="showWordResult ? (isWordRight ? 'right' : 'wrong') : ''"
      >
        <template v-for="i in input">
          <span class="l" v-if="i !== ' '">{{ i }}</span>
          <Space class="l" v-else :is-wrong="showWordResult ? !isWordRight : false" :is-wait="!showWordResult" />
        </template>
      </div>
    </div>

    <!-- 非默写模式 -->
    <template v-else>
      <span class="input" v-if="input">{{ input }}</span>
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
