<script setup lang="ts">
/**
 * WordTypingCoreV2 — 纯键入引擎
 *
 * 从 TypeWordV2 拆出，负责：
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
import { ShortcutKey, WordPracticeType } from '@typewords/core/types/enum.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import {
  cancelWordPracticeAudio,
  resetActiveWordPlayCount,
  usePlayBeep,
  usePlayCorrect,
  usePlayKeyboardAudio,
} from '@typewords/core/hooks/sound.ts'
import { WordPlayTrigger } from '~/composables/practice-words/usePracticeWordAudioV2.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { onMounted, onUnmounted, watch } from 'vue'
import Space from '@typewords/core/components/article/Space.vue'
import { _nextTick, last, normalizeWord } from '@typewords/core/utils'
import { useOnKeyboardEventListener } from '@typewords/core/hooks/event.ts'

interface IProps {
  word: Word
  showWordResult: boolean
  wrongTimes: number
  showFullWord: boolean
  /** 当前是否为听写模式（仅用于字母遮罩） */
  isDictation: boolean
  /** 当前单词字体大小 */
  wordFontSize: number
  /** 发音图标的 DOM ref，用于音量动画定位 */
  volumeIconRef: any
  /** 外部注入的 playWord 函数 */
  playWord: (trigger: WordPlayTrigger, opts?: { volumeRef?: any; resetIcon?: boolean }) => void
  /** 是否正在编辑笔记（隐藏光标） */
  editingNote: boolean
  containerRef?: HTMLElement
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  showWordResult: false,
  wrongTimes: 0,
  showFullWord: false,
  isDictation: false,
  wordFontSize: 48,
  volumeIconRef: undefined,
  playWord: () => {},
  editingNote: false,
})

const emit = defineEmits<{
  'update:showWordResult': [value: boolean]
  'update:wrongTimes': [value: number]
  'cursor-change': [value: { top: number; left: number }]
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
let pressNumber = 0
let showNotice = false
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

function setCursor(nextCursor: { top: number; left: number }) {
  cursor = nextCursor
  emit('cursor-change', nextCursor)
}

// ============ 计算属性 ============

let displayWord = $computed(() => {
  return props.word.word.slice(input.length + wrong.length)
})

const right = $computed(() => {
  let a = input
  let b = props.word.word

  if (settingStore.wordPracticeType === WordPracticeType.Dictation) {
    a = normalizeWord(a)
    b = normalizeWord(b)
  }
  if (settingStore.ignoreCase) {
    return a.toLowerCase() === b.toLowerCase()
  } else {
    return a === b
  }
})

// ============ 辅助函数 ============

function isTypingSentence() {
  return false
}

function clearJumpTimer() {
  if (!jumpTimer) {
    return
  }
  clearTimeout(jumpTimer)
  jumpTimer = null
}

function typo() {
  emit('wrong')
  emitWrongTimes(props.wrongTimes + 1)
}

function shouldRepeat() {
  if (settingStore.wordPracticeType === WordPracticeType.FollowWrite) {
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
  setTimeout(() => {
    wrong = input = ''
    wordRepeatCount++
    inputLock = false

    if (settingStore.wordSound) props.playWord(WordPlayTrigger.RepeatWord)
  }, settingStore.waitTimeForChangeWord)
}

// ============ 核心键入逻辑 ============

function completeTypeWord(delay: boolean) {
  if (shouldRepeat()) {
    repeat()
  } else {
    if (delay) {
      clearJumpTimer()
      jumpTimer = setTimeout(() => emit('complete'), settingStore.waitTimeForChangeWord)
    } else {
      emit('complete')
    }
  }
}

function del() {
  playKeyboardAudio()
  inputLock = false
  if (props.showWordResult) {
    input = ''
    emitShowWordResult(false)
    //如果是自测阶段，按删除键代码弄错了，需要标记为错词，同时从excludeWords里排除
    if (settingStore.wordPracticeType === WordPracticeType.Identify) {
      typo()
      if (settingStore.wordSound) props.playWord(WordPlayTrigger.DelRetry)
    }
  } else {
    if (wrong) {
      wrong = ''
    } else {
      input = input.slice(0, -1)
    }
  }
}

async function onTyping(e: KeyboardEvent) {
  if (waitClear) {
    return
  }

  // debugger
  const target = props.word.word
  const targetVolumeIcon = props.volumeIconRef

  // 输入完成会锁死不能再输入
  if (inputLock) {
    //判断是否是空格键以便切换到下一个
    if (e.code === 'Space') {
      //正确时就切换到下一个
      if (right) {
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
      if (right) {
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
  if (settingStore.wordPracticeType === WordPracticeType.Dictation) {
    if (e.code === 'Space') {
      //如果输入长度大于单词长度/单词不包含空格，并且输入不为空（开始直接输入空格不行），则显示单词；
      if (input.length && (input.length >= target.length || !target.includes(' '))) {
        //比对是否一致
        if (right) {
          //如果已显示单词，则发射完成事件，并 return
          if (props.showWordResult) {
            return emit('complete')
          } else {
            //未显示单词，则播放正确音乐，并在后面设置为 showWordResult.value 为 true 来显示单词
            emitShowWordResult(true)
            playCorrect()
            if (settingStore.wordSound) {
              props.playWord(WordPlayTrigger.DictationReveal, { volumeRef: targetVolumeIcon })
            }
          }
        } else {
          //错误处理
          playBeep()
          emitShowWordResult(true)
          if (settingStore.wordSound) {
            props.playWord(WordPlayTrigger.DictationReveal, { volumeRef: targetVolumeIcon })
          }
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
  } else if (settingStore.wordPracticeType === WordPracticeType.Identify && !props.showWordResult) {
    //当自测模式下，按其他键则自动默认为不认识
    emitShowWordResult(true)
    typo()
    if (settingStore.wordSound) {
      props.playWord(WordPlayTrigger.IdentifyWrongKey, { volumeRef: targetVolumeIcon })
    }
    inputLock = false
    onTyping(e)
  } else {
    let isRight = false
    if (settingStore.ignoreCase) {
      isRight = letter.toLowerCase() === target[input.length]?.toLowerCase()
    } else {
      isRight = letter === target[input.length]
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
      isRight = true
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
      isRight = true
      letter = target[input.length]
    }

    if (isRight) {
      input += letter
      wrong = ''
      playKeyboardAudio()
    } else {
      typo()
      wrong = letter
      playBeep()
      if (settingStore.wordSound) {
        props.playWord(WordPlayTrigger.Typo, { volumeRef: targetVolumeIcon })
      }
      waitClear = true
      setTimeout(() => {
        if (settingStore.inputWrongClear) input = ''
        wrong = ''
        waitClear = false
      }, 500)
    }
    // 更新当前单词信息
    //不需要把inputLock设为false，输入完成不能再输入了，只能删除，删除会打开锁
    if (input.toLowerCase() === target.toLowerCase()) {
      wordCompletedTime = Date.now() // 记录单词完成的时间戳
      playCorrect()
      if (
        [WordPracticeType.Listen, WordPracticeType.Identify].includes(settingStore.wordPracticeType) &&
        !props.showWordResult
      ) {
        emitShowWordResult(true)
      }
      if (
        [WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(settingStore.wordPracticeType)
      ) {
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
  clearJumpTimer()
  cancelWordPracticeAudio()
  wrong = input = ''
  wordRepeatCount = 0
  emitShowWordResult(false)
  inputLock = false
  wordCompletedTime = 0
  emitWrongTimes(0)
  resetActiveWordPlayCount(props.word.word)
  if (settingStore.wordSound && settingStore.wordPracticeType !== WordPracticeType.Dictation) {
    props.playWord(trigger, { resetIcon: trigger === WordPlayTrigger.NewWord })
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
    const containerRect = props.containerRef?.getBoundingClientRect() ?? typingWordRect
    const cursorHeight = isTypingSentence() ? 20 : props.wordFontSize

    if (inputList.length) {
      let inputRect = last(Array.from(inputList)).getBoundingClientRect()
      setCursor({
        top: inputRect.top + inputRect.height - cursorHeight - containerRect.top + cursorOffset.top,
        left: inputRect.right - containerRect.left + cursorOffset.left,
      })
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
      setCursor({
        top: elRect.top + elRect.height - cursorHeight - containerRect.top + cursorOffset.top,
        left: elRect.left - containerRect.left + cursorOffset.left,
      })
    }
  })
}

// ============ 键盘事件 ============

function onKeyDown(e: KeyboardEvent) {
  switch (e.key) {
    case 'Backspace':
      del()
      break
  }
}

function onKeyUp(_e: KeyboardEvent) {
  // hideWord 由父组件处理
}

useOnKeyboardEventListener(onKeyDown, onKeyUp)

// ============ 生命周期 ============

watch(
  () => props.word,
  () => resetTypingCore(WordPlayTrigger.NewWord)
)

watch(
  () => input,
  () => {
    checkCursorPosition()
  }
)

watch(
  [() => input, () => props.showFullWord, () => props.isDictation],
  () => {
    checkCursorPosition()
  }
)

onMounted(() => {
  emitter.on(EventKey.resetWord, onResetWord)
  emitter.on(EventKey.onTyping, onTyping)
  checkCursorPosition()
})

onUnmounted(() => {
  clearJumpTimer()
  emitter.off(EventKey.resetWord, onResetWord)
  emitter.off(EventKey.onTyping, onTyping)
})

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
  input,
  wrong,
  showWordResult: () => props.showWordResult,
  wrongTimes: () => props.wrongTimes,
  right,
  displayWord,
  isTypingSentence,
  cursor,
  resetTypingCore,
  del,
  checkCursorPosition,
  revealWord,
  setWordTestResult,
})
</script>

<template>
  <div class="typing-core" ref="typingWordRef">
    <!-- 默写模式 -->
    <div v-if="settingStore.wordPracticeType === WordPracticeType.Dictation">
      <div
        class="letter text-align-center w-full inline-block"
        v-opacity="!isDictation || showWordResult || showFullWord"
      >
        {{ word.word }}
      </div>
      <div
        class="mt-2 w-120 dictation"
        :style="{ minHeight: wordFontSize + 'px' }"
        :class="showWordResult ? (right ? 'right' : 'wrong') : ''"
      >
        <template v-for="i in input">
          <span class="l" v-if="i !== ' '">{{ i }}</span>
          <Space class="l" v-else :is-wrong="showWordResult ? !right : false" :is-wait="!showWordResult" />
        </template>
      </div>
    </div>

    <!-- 非默写模式 -->
    <template v-else>
      <span class="input" v-if="input">{{ input }}</span>
      <span class="wrong" v-if="wrong">{{ wrong }}</span>
      <span class="letter" v-if="isDictation && !showFullWord">
        {{
          displayWord
            .split('')
            .map(v => (v === ' ' ? '&nbsp;' : '_'))
            .join('')
        }}
      </span>
      <span class="letter" v-else>{{ displayWord }}</span>
    </template>
  </div>
</template>

<style scoped lang="scss">
.dictation {
  border-bottom: 2px solid gray;
}

.typing-core {
  position: relative;

  .input,
  .right {
    color: rgb(22, 163, 74);
  }

  .wrong {
    color: rgba(red, 0.6);
  }
}
</style>
