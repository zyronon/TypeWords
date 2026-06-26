<script setup lang="ts">
import type { Question, Word } from '@typewords/core/types/types.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import { IdentifyMethod, ShortcutKey, WordPracticeType } from '@typewords/core/types/enum.ts'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import {
  cancelWordPracticeAudio,
  resetActiveWordPlayCount,
  usePlayBeep,
  usePlayCorrect,
  usePlayKeyboardAudio,
} from '@typewords/core/hooks/sound.ts'
import { WordPlayTrigger, usePracticeWordAudioV2 } from '~/composables/practice-words/usePracticeWordAudioV2.ts'
import { useInjectedDisplayPolicy } from '~/composables/practice-words/usePracticeDisplayPolicy.ts'
import { emitter, EventKey, useEventsByWatch } from '@typewords/core/utils/eventBus.ts'
import { computed, onMounted, onUnmounted, toRef, watch } from 'vue'
import SentenceHightLightWord from '@typewords/core/components/word/SentenceHightLightWord.vue'
import ClickableEnglishText from '@typewords/core/components/word/ClickableEnglishText.vue'
import ClickableWord from '@typewords/core/components/word/ClickableWord.vue'
import WordLookupPopover from '@typewords/core/components/word/WordLookupPopover.vue'
import { _nextTick, last, normalizeWord, useNav } from '@typewords/core/utils'
import { BaseButton, BaseIcon, Textarea, Toast, ToastComponent, Tooltip, VolumeIcon } from '@typewords/base'
import Space from '@typewords/core/components/article/Space.vue'
import { useI18n } from 'vue-i18n'
import { useWordOptions } from '@typewords/core/hooks/dict.ts'
import { openWordCollectPicker } from '@typewords/core/hooks/useWordCollectPicker.ts'
import { ref } from 'vue'
import TranslationList from '@typewords/core/components/word/TranslationList.vue'
import { useOnKeyboardEventListener } from '@typewords/core/hooks/event.ts'

const SENTENCE_PLAY_SHORTCUT_KEYS = [
  ShortcutKey.PlaySentence1,
  ShortcutKey.PlaySentence2,
  ShortcutKey.PlaySentence3,
  ShortcutKey.PlaySentence4,
  ShortcutKey.PlaySentence5,
  ShortcutKey.PlaySentence6,
  ShortcutKey.PlaySentence7,
  ShortcutKey.PlaySentence8,
  ShortcutKey.PlaySentence9,
] as const

const { t: $t } = useI18n()

interface IProps {
  word: Word
  question?: Question
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
})

const emit = defineEmits<{
  complete: []
  wrong: []
  know: []
  mastered: []
  skip: []
  toggleSimple: []
}>()

let input = $ref('')
let wrong = $ref('')
let showFullWord = $ref(false)
let showWordResult = ref(false)
//错误次数
let wrongTimes = ref(0)
//输入锁定，因为跳转到下一个单词有延时，如果重复在延时期间内重复输入，导致会跳转N次
let inputLock = false
let waitClear = false
let wordRepeatCount = 0
// 记录单词完成的时间戳，用于防止同时按下最后一个字母和空格键时跳过单词
let wordCompletedTime = 0
let jumpTimer: ReturnType<typeof setTimeout> | null = null
let cursor = $ref({
  top: 0,
  left: 0,
})
const settingStore = useSettingStore()
const store = useBaseStore()

const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()

const volumeIconRef: any = $ref()
const sentenceVolumeIconsRefs: any = $ref([])

const baseDisplay = useInjectedDisplayPolicy()
const effective = computed(() => {
  const b = baseDisplay.value
  const reveal = showFullWord || showWordResult.value
  return {
    ...b,
    showSentences: b.showSentences || reveal,
    showSentenceTranslation: b.showSentenceTranslation || reveal,
    showWordTranslation: b.showWordTranslation || reveal,
    showPhrases: b.showPhrases || reveal,
    showEtymology: b.showEtymology || reveal,
    showRelWords: b.showRelWords || reveal,
    wordMask: showWordResult.value ? 'none' : b.wordMask,
    dictation: showWordResult.value ? false : b.dictation,
    translate: b.translate || reveal,
    showPhoneticShadow: showWordResult.value ? false : b.showPhoneticShadow,
  }
})

const { highlightedSentenceIndex, playWord, playSentence, playTtsWithGuide } = usePracticeWordAudioV2({
  word: toRef(props, 'word'),
  volumeIconRef: computed(() => volumeIconRef),
  shouldShowSentences: () => effective.value.showSentences,
})

function getSentenceShortcut(index: number) {
  const key = SENTENCE_PLAY_SHORTCUT_KEYS[index]
  return key ? settingStore.shortcutKeyMap[key] : ''
}
const typingWordRef = $ref<HTMLDivElement>()
// const volumeTranslateIconRef: any = $ref()

let showAllCandidates = $ref(false)
let editingNote = $ref(false)
let noteInputValue = $ref('')

let displayWord = $computed(() => {
  return props.word.word.slice(input.length + wrong.length)
})
let displaySentence = $computed(() => {
  return props.word.sentences[currentPracticeSentenceIndex].c.slice(input.length + wrong.length)
})

let isSelfAssessment = $computed(() => {
  return (
    settingStore.wordPracticeType === WordPracticeType.Identify &&
    settingStore.identifyMethod === IdentifyMethod.SelfAssessment
  )
})

let isWordTest = $computed(() => {
  return (
    settingStore.wordPracticeType === WordPracticeType.Identify &&
    settingStore.identifyMethod === IdentifyMethod.WordTest
  )
})

// v2：键盘由 usePracticeWordKeyboard 统一处理，不再写 __CURRENT_WORD_INFO__

watch(
  () => props.word,
  () => resetState(WordPlayTrigger.NewWord)
)

function resetState(trigger: WordPlayTrigger) {
  clearJumpTimer()
  cancelWordPracticeAudio()
  wrong = input = ''
  wordRepeatCount = 0
  showWordResult.value = inputLock = completeSelect = showAllCandidates = false
  editingNote = false
  noteInputValue = ''
  currentPracticeSentenceIndex = -1
  wordCompletedTime = 0
  wrongTimes.value = 0
  highlightedSentenceIndex.value = -1
  resetActiveWordPlayCount(props.word.word)
  if (settingStore.wordSound && settingStore.wordPracticeType !== WordPracticeType.Dictation) {
    playWord(trigger, { resetIcon: trigger === WordPlayTrigger.NewWord })
  }
  checkCursorPosition()
}

watch(
  () => input,
  () => {
    checkCursorPosition()
  }
)

function onKeyUp(e: KeyboardEvent) {
  hideWord()
}

function onKeyDown(e: KeyboardEvent) {
  switch (e.key) {
    case 'Backspace':
      del()
      break
  }
}

useOnKeyboardEventListener(onKeyDown, onKeyUp)

onMounted(() => {
  // 初始化当前单词信息
  emitter.on(EventKey.resetWord, onResetWord)
  emitter.on(EventKey.onTyping, onTyping)
})

function onResetWord() {
  resetState(WordPlayTrigger.ResetSameWord)
}

onUnmounted(() => {
  clearJumpTimer()
  emitter.off(EventKey.resetWord, onResetWord)
  emitter.off(EventKey.onTyping, onTyping)
})

function clearJumpTimer() {
  if (!jumpTimer) {
    return
  }
  clearTimeout(jumpTimer)
  jumpTimer = null
}

function repeat() {
  setTimeout(() => {
    wrong = input = ''
    wordRepeatCount++
    inputLock = false

    if (settingStore.wordSound) playWord(WordPlayTrigger.RepeatWord)
  }, settingStore.waitTimeForChangeWord)
}

let pressNumber = 0

const right = $computed(() => {
  let a = input
  let b
  if (isTypingSentence()) {
    b = props.word.sentences[currentPracticeSentenceIndex].c
  } else {
    b = props.word.word
  }

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

let showNotice = false

function know(e) {
  if (isSelfAssessment) {
    if (!showWordResult.value) {
      inputLock = showWordResult.value = true
      input = props.word.word
      emit('know')
      if (!showNotice) {
        Toast.info($t('know_word_tip'), { duration: 5000 })
        showNotice = true
      }
      return
    }
  }
  onTyping(e)
}

function mastered(e) {
  if (isSelfAssessment) {
    emit('mastered')
    return
  }
  onTyping(e)
}

function unknown(e) {
  if (isSelfAssessment) {
    if (!showWordResult.value) {
      showWordResult.value = true
      typo()
      if (settingStore.wordSound) playWord(WordPlayTrigger.RevealUnknown)
      return
    }
  }
  onTyping(e)
}

let selectIndex = $ref(-1)
let completeSelect = false
function select(e, index: number) {
  if (completeSelect) return
  if (isWordTest) {
    completeSelect = true
    selectIndex = index
    if (index == props?.question?.correctIndex) {
      input = props.word.word
      playCorrect()
      emit('know')
    } else {
      wrong = props.word.word
      playBeep()
      play()
      emit('wrong')
    }

    if (!showNotice) {
      Toast.info($t('press_space_continue'), { duration: 5000 })
      showNotice = true
    }
    return
  }
  onTyping(e)
}

let currentPracticeSentenceIndex = $ref(-1)

async function onTyping(e: KeyboardEvent) {
  if (waitClear) {
    return
  }

  if (isWordTest) {
    if (e.code === 'Space') {
      if (completeSelect) {
        completeTypeWord(false)
      } else {
        select(e, -1)
      }
    }
    return
  }

  // debugger
  let target
  let targetVolumeIcon
  if (isTypingSentence()) {
    target = props.word.sentences[currentPracticeSentenceIndex].c
    targetVolumeIcon = sentenceVolumeIconsRefs[currentPracticeSentenceIndex]
  } else {
    target = props.word.word
    targetVolumeIcon = volumeIconRef
  }
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
        showWordResult.value = inputLock = false
      } else {
        if (showWordResult.value) {
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
      if (right) {
        pressNumber++
        if (pressNumber >= 3) {
          Toast.info($t('press_space_continue'), { duration: 2000 })
          pressNumber = 0
        }
      } else {
        //当错误时，按任意键重新输入
        showWordResult.value = inputLock = false
        input = wrong = ''
        onTyping(e)
      }
    }
    return
  }
  inputLock = true
  let letter = e.key
  // console.log('letter',letter)
  //默写特殊逻辑
  if (settingStore.wordPracticeType === WordPracticeType.Dictation) {
    if (e.code === 'Space') {
      //如果输入长度大于单词长度/单词不包含空格，并且输入不为空（开始直接输入空格不行），则显示单词；
      // 这里inputLock 不设为 false，不能再输入了，只能删除（删除会重置 inputLock）或按空格切下一格
      if (input.length && (input.length >= target.length || !target.includes(' '))) {
        //比对是否一致
        if (right) {
          //如果已显示单词，则发射完成事件，并 return
          if (showWordResult.value) {
            return emit('complete')
          } else {
            //未显示单词，则播放正确音乐，并在后面设置为 showWordResult.value 为 true 来显示单词
            showWordResult.value = true
            playCorrect()
            if (settingStore.wordSound) {
              playWord(WordPlayTrigger.DictationReveal, { volumeRef: targetVolumeIcon })
            }
          }
        } else {
          //错误处理
          playBeep()
          showWordResult.value = true
          if (settingStore.wordSound) {
            playWord(WordPlayTrigger.DictationReveal, { volumeRef: targetVolumeIcon })
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
  } else if (settingStore.wordPracticeType === WordPracticeType.Identify && !showWordResult.value) {
    //当自测模式下，按其他键则自动默认为不认识
    showWordResult.value = true
    typo()
    if (settingStore.wordSound) {
      playWord(WordPlayTrigger.IdentifyWrongKey, { volumeRef: targetVolumeIcon })
    }
    inputLock = false
    onTyping(e)
  } else {
    let right = false
    // console.log('letter', letter, target, input.length, target[input.length])
    if (settingStore.ignoreCase) {
      right = letter.toLowerCase() === target[input.length].toLowerCase()
    } else {
      right = letter === target[input.length]
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
      right = true
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
      right = true
      letter = target[input.length]
    }
    // console.log('e', e, e.code, e.shiftKey, word[input.length])

    if (right) {
      input += letter
      wrong = ''
      playKeyboardAudio()
    } else {
      typo()
      wrong = letter
      playBeep()
      if (settingStore.wordSound) {
        playWord(WordPlayTrigger.Typo, { volumeRef: targetVolumeIcon })
      }
      waitClear = true
      setTimeout(() => {
        if (settingStore.inputWrongClear && !isTypingSentence()) input = ''
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
        !showWordResult.value
      ) {
        showWordResult.value = true
      }
      if ([WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(settingStore.wordPracticeType)) {
        if (settingStore.autoNextWord) {
          completeTypeWord(true)
        }
      }
    } else {
      //这里不要移动inputLock，否则输入完成时无法进入空格键的判断
      inputLock = false
    }
  }
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

function isTypingSentence() {
  return currentPracticeSentenceIndex !== -1
}

function completeTypeWord(delay: boolean) {
  if (settingStore.wordPracticeType === WordPracticeType.FollowWrite && settingStore.practiceSentence) {
    currentPracticeSentenceIndex++
    if (currentPracticeSentenceIndex < props.word.sentences.length) {
      // 还有下一个句子
      inputLock = false
      wrong = input = ''
      return
    }
  }
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
  if (showWordResult.value) {
    input = ''
    showWordResult.value = false
    //如果是自测阶段，按删除键代码弄错了，需要标记为错词，同时从excludeWords里排除
    if (settingStore.wordPracticeType === WordPracticeType.Identify) {
      typo()
      if (settingStore.wordSound) playWord(WordPlayTrigger.DelRetry)
    }
  } else {
    if (wrong) {
      wrong = ''
    } else {
      input = input.slice(0, -1)
    }
  }
  // 更新当前单词信息
}

function showWord() {
  if (settingStore.allowWordTip) {
    //如果不是跟写模式，查看单词一律标记为错词
    if (settingStore.wordPracticeType !== WordPracticeType.FollowWrite || effective.value.dictation) {
      typo()
    }
    if (
      settingStore.wordPracticeType === WordPracticeType.Identify &&
      settingStore.identifyMethod === IdentifyMethod.WordTest
    ) {
      showAllCandidates = true
      return
    }
    showFullWord = true
  }
}

function hideWord() {
  showAllCandidates = false
  showFullWord = false
}

function editNote() {
  editingNote = !editingNote
  if (editingNote) {
    noteInputValue = store.noteData[props.word.word] ?? ''
  } else {
    noteInputValue = ''
  }
}

function saveNote() {
  if (noteInputValue.trim()) {
    store.noteData[props.word.word] = noteInputValue
  } else {
    delete store.noteData[props.word.word]
  }
  editingNote = false
}

function cancelNote() {
  editingNote = false
  noteInputValue = ''
}

function deleteNote() {
  delete store.noteData[props.word.word]
  editingNote = false
  noteInputValue = ''
}

function typo() {
  emit('wrong')
  wrongTimes.value++
}

function checkIsWrong() {
  if (effective.value.isDictationInput || effective.value.dictation) {
    if (!showWordResult.value && !right) {
      //输入完成，或者已显示的情况下，不记入错误
      typo()
    }
  }
}

function onVolumeIconClick() {
  checkIsWrong()
  playWord(WordPlayTrigger.Manual)
}

function play() {
  checkIsWrong()
  playWord(WordPlayTrigger.Shortcut)
}

function mouseleave() {
  setTimeout(() => {
    showFullWord = false
  }, 50)
}

watch([() => input, () => showFullWord, () => effective.value.dictation], checkCursorPosition)

//检测光标位置
function checkCursorPosition() {
  _nextTick(() => {
    let cursorOffset
    if (isTypingSentence()) {
      cursorOffset = { top: 0, left: 0 }
    } else {
      cursorOffset = { top: 0, left: -3 }
    }
    // 选中目标元素
    const cursorEl = document.querySelector(`.cursor`)
    const inputList = document.querySelectorAll(`.l`)
    if (!typingWordRef || !cursorEl) return
    const typingWordRect = typingWordRef.getBoundingClientRect()

    if (inputList.length) {
      let inputRect = last(Array.from(inputList)).getBoundingClientRect()
      cursor = {
        top: inputRect.top + inputRect.height - cursorEl.clientHeight - typingWordRect.top + cursorOffset.top,
        left: inputRect.right - typingWordRect.left + cursorOffset.left,
      }
    } else {
      const dictation = document.querySelector(`.dictation`)
      let elRect
      if (dictation) {
        elRect = dictation.getBoundingClientRect()
      } else {
        const letter = document.querySelector(`.letter`)
        elRect = letter.getBoundingClientRect()
      }
      cursor = {
        top: elRect.top + elRect.height - cursorEl.clientHeight - typingWordRect.top + cursorOffset.top,
        left: elRect.left - typingWordRect.left + cursorOffset.left,
      }
    }
  })
}

useEventsByWatch(
  [
    [ShortcutKey.KnowWord, know],
    [ShortcutKey.UnknownWord, unknown],
    [ShortcutKey.MasteredWord, mastered],
  ],
  () => isSelfAssessment
)

useEventsByWatch(
  [
    [ShortcutKey.ChooseA, e => select(e, 0)],
    [ShortcutKey.ChooseB, e => select(e, 1)],
    [ShortcutKey.ChooseC, e => select(e, 2)],
    [ShortcutKey.ChooseD, e => select(e, 3)],
  ],
  () => isWordTest
)

useEventsByWatch(
  SENTENCE_PLAY_SHORTCUT_KEYS.map((key, index) => [key, () => playSentence(index, { highlight: true })]),
  () => (props.word.sentences?.length ?? 0) > 0
)

const notice = $computed(() => {
  let text =
    settingStore.wordPracticeType === WordPracticeType.Identify
      ? '选择后/输入后，按空格键切换下一个'
      : settingStore.wordPracticeType === WordPracticeType.Listen
        ? '输入完成后按空格键切换下一个'
        : showWordResult.value
          ? right
            ? '按空格键切换下一个'
            : $t('press_delete_reinput')
          : '按空格键完成输入'
  return {
    show: [WordPracticeType.Listen, WordPracticeType.Identify, WordPracticeType.Dictation].includes(
      settingStore.wordPracticeType
    ),
    text,
  }
})

const { isWordSimple, toggleWordSimple } = useWordOptions()

const collectAnchorRef = ref<HTMLElement | null>(null)

function openCollectPicker(e: MouseEvent) {
  e.stopPropagation()
  openWordCollectPicker(props.word, e.currentTarget as HTMLElement, {
    excludeDictId: store.sdict.id ? String(store.sdict.id) : undefined,
  })
}

const isSimple = $computed(() => isWordSimple(props.word))

defineExpose({
  del,
  showWord,
  hideWord,
  play,
  showWordResult,
  wrongTimes,
  getCollectAnchor: () => collectAnchorRef.value,
})
</script>

<template>
  <div class="typing-word" ref="typingWordRef" v-if="word.word.length">
    <div class="flex flex-col items-center">
      <div class="flex gap-1 mt-10 md:mt-30">
        <div
          class="phonetic"
          :class="
            (effective.showPhoneticShadow && !showFullWord && !showWordResult && 'word-shadow')
          "
          v-if="settingStore.soundType === 'uk' && word.phonetic0"
        >
          / {{ word.phonetic0 }} /
        </div>
        <div
          class="phonetic"
          :class="(effective.showPhoneticShadow && !showFullWord && !showWordResult && 'word-shadow')"
          v-if="settingStore.soundType === 'us' && word.phonetic1"
        >
          / {{ word.phonetic1 }} /
        </div>
        <VolumeIcon
          :title="`发音(${settingStore.shortcutKeyMap[ShortcutKey.PlayWordPronunciation]})`"
          ref="volumeIconRef"
          :simple="true"
          @click="onVolumeIconClick"
        />
      </div>

      <Tooltip
        :title="effective.dictation ? `快捷键 ${settingStore.shortcutKeyMap[ShortcutKey.ShowWord]} 显示单词` : ''"
      >
        <div
          id="word"
          class="word my-1"
          :class="wrong && !isTypingSentence() ? 'is-wrong' : ''"
          :style="{ fontSize: settingStore.fontSize.wordForeignFontSize + 'px' }"
          @mouseenter="showWord"
          @mouseleave="mouseleave"
        >
          <div v-if="settingStore.wordPracticeType === WordPracticeType.Dictation">
            <div
              class="letter text-align-center w-full inline-block"
              v-opacity="!effective.dictation || showWordResult || showFullWord"
            >
              {{ word.word }}
            </div>
            <div
              class="mt-2 w-120 dictation"
              :style="{ minHeight: settingStore.fontSize.wordForeignFontSize + 'px' }"
              :class="showWordResult ? (right ? 'right' : 'wrong') : ''"
            >
              <template v-for="i in input">
                <span class="l" v-if="i !== ' '">{{ i }}</span>
                <Space class="l" v-else :is-wrong="showWordResult ? !right : false" :is-wait="!showWordResult" />
              </template>
            </div>
          </div>
          <template v-else>
            <div v-if="currentPracticeSentenceIndex === -1">
              <span class="input" v-if="input">{{ input }}</span>
              <span class="wrong" v-if="wrong">{{ wrong }}</span>
              <span class="letter" v-if="effective.dictation && !showFullWord">
                {{
                  displayWord
                    .split('')
                    .map(v => (v === ' ' ? '&nbsp;' : '_'))
                    .join('')
                }}
              </span>
              <span class="letter" v-else>{{ displayWord }}</span>
            </div>
            <div v-else>
              <span class="input">{{ word.word }}</span>
            </div>
          </template>
        </div>
      </Tooltip>

      <!--      单词操作按钮-->
      <div class="mt-2 flex gap-4">
        <BaseIcon
          @click="emit('toggleSimple')"
          :title="
            (!isSimple ? $t('mark_mastered') : $t('unmark_mastered')) +
            `(${settingStore.shortcutKeyMap[ShortcutKey.ToggleSimple]})`
          "
        >
          <IconFluentCheckmarkCircle16Regular v-if="!isSimple" />
          <IconFluentCheckmarkCircle16Filled v-else />
        </BaseIcon>
        <BaseIcon @click="editNote" :title="editingNote ? '完成编辑笔记' : '编辑笔记'">
          <IconFluentClipboardTextEdit20Regular />
        </BaseIcon>
        <span ref="collectAnchorRef" class="inline-flex">
          <BaseIcon
            class="word-collect-anchor"
            @click="openCollectPicker"
            :title="`${$t('collect_to_dict')}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleCollect]})`"
          >
            <IconFluentStarAdd16Regular />
          </BaseIcon>
        </span>
        <BaseIcon @click="emit('skip')" :title="`${$t('skip_word')}(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`">
          <IconFluentArrowBounce20Regular class="transform-rotate-180" />
        </BaseIcon>
      </div>

      <div class="mt-4 flex gap-2" v-if="isSelfAssessment && !showWordResult">
        <BaseButton
          :keyboard="`${$t('shortcut')}(${settingStore.shortcutKeyMap[ShortcutKey.KnowWord]})`"
          size="large"
          @click="know"
          >{{ $t('i_know') }}
        </BaseButton>
        <BaseButton
          :keyboard="`${$t('shortcut')}(${settingStore.shortcutKeyMap[ShortcutKey.UnknownWord]})`"
          size="large"
          @click="unknown"
          >{{ $t('i_dont_know') }}
        </BaseButton>
        <BaseButton
          :keyboard="`${$t('shortcut')}(${settingStore.shortcutKeyMap[ShortcutKey.MasteredWord]})`"
          size="large"
          @click="mastered"
          >已掌握
        </BaseButton>
      </div>

      <div v-if="isWordTest && !showWordResult" class="flex gap-8 flex-col my-8 w-full">
        <div
          v-for="(value, index) in question?.candidates ?? []"
          class="flex gap-2 min-h-20"
          :class="{
            'text-green-600': completeSelect && index === props?.question?.correctIndex,
            'text-red-600': completeSelect && index !== props?.question?.correctIndex && index === selectIndex,
          }"
        >
          <BaseButton
            :keyboard="`${$t('shortcut')}(${settingStore.shortcutKeyMap[[ShortcutKey.ChooseA, ShortcutKey.ChooseB, ShortcutKey.ChooseC, ShortcutKey.ChooseD][index]]})`"
            @click="e => select(e, index)"
          >
            {{ ['A', 'B', 'C', 'D'][index] }}
          </BaseButton>
          <span class="ml-2">
            <div class="min-h-10 text-2xl" :class="{ 'word-shadow': !showAllCandidates && !completeSelect }">
              {{ value.word.word }}
            </div>
            <TranslationList :word="value.word" :showFull="showAllCandidates || completeSelect" />
          </span>
        </div>
      </div>

      <div class="center mt-3" v-if="notice.show && settingStore.showUsageTips">
        <ToastComponent
          :duration="0"
          confirm
          :shadow="false"
          :showClose="store.sdict.statistics.length > 2"
          :message="notice.text"
          @close="settingStore.showUsageTips = false"
        />
      </div>

      <div
        class="translate flex flex-col gap-2 my-3"
        v-opacity="effective.showWordTranslation || showWordResult || showFullWord"
        :style="{
          fontSize: settingStore.fontSize.wordTranslateFontSize + 'px',
        }"
      >
        <TranslationList :word="word" :showFull="!effective.dictation || showWordResult || showFullWord" />
      </div>
    </div>

    <template v-if="editingNote || store.noteData[word.word]?.trim()">
      <div class="line-white my-3"></div>
      <div class="flex flex-col gap-2">
        <div class="flex">
          <div class="label">笔记</div>
          <Textarea
            autofocus
            v-if="editingNote"
            v-model="noteInputValue"
            placeholder="记录这个单词的个人笔记"
            :autosize="{ minRows: 4, maxRows: 8 }"
            class="note-textarea"
          />
          <div v-else class="note-content">{{ store.noteData[word.word] }}</div>
        </div>
        <div v-if="editingNote" class="flex justify-end mt-2">
          <BaseButton size="large" type="info" v-if="store.noteData[word.word]" @click="deleteNote">删除</BaseButton>
          <BaseButton size="large" @click="cancelNote">取消</BaseButton>
          <BaseButton size="large" type="primary" @click="saveNote">保存</BaseButton>
        </div>
      </div>
    </template>

    <div
      class="other anim"
      v-opacity="effective.showSentences"
    >
      <template v-if="word?.sentences?.length">
        <div class="line-white my-3"></div>
        <div
          class="sentence"
          :class="{
            'is-wrong': wrong && currentPracticeSentenceIndex === index,
            'sentence-highlight': highlightedSentenceIndex === index,
          }"
          v-for="(item, index) in word.sentences"
          :key="index"
        >
          <div class="flex gap-space text-xl">
            <div v-if="index !== currentPracticeSentenceIndex">
              <ClickableEnglishText
                :text="item.c"
                :word="word.word"
                :dictation="!(!effective.dictation || showFullWord || showWordResult)"
              />
            </div>
            <div v-else>
              <span class="input" v-if="input">{{ input }}</span>
              <span class="wrong" v-if="wrong">{{ wrong }}</span>
              <span class="letter">{{ displaySentence }}</span>
            </div>
            <VolumeIcon
              :title="getSentenceShortcut(index) ? `发音(${getSentenceShortcut(index)})` : '发音'"
              :simple="false"
              @click.stop="() => playSentence(index)"
              ref="sentenceVolumeIconsRefs"
            />
          </div>
          <div class="text-base anim" v-opacity="effective.showSentenceTranslation || showFullWord || showWordResult">
            {{ item.cn }}
          </div>
        </div>
      </template>

      <template v-if="word?.phrases?.length">
        <div class="line-white my-3"></div>
        <div class="flex">
          <div class="label">{{ $t('phrases') }}</div>
          <div class="flex flex-col">
            <div class="flex items-center gap-4" v-for="(item, index) in word.phrases" :key="index">
              <div class="flex gap-space items-center">
                <ClickableEnglishText
                  class="en"
                  :text="item.c"
                  :word="word.word"
                  :dictation="!(!effective.dictation || showFullWord || showWordResult)"
                />
                <VolumeIcon :simple="false" title="发音" @click.stop="() => playTtsWithGuide(item.c)" />
              </div>
              <div class="cn anim" v-opacity="effective.showSentenceTranslation || showFullWord || showWordResult">
                {{ item.cn }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="effective.showPhrases || effective.showEtymology || effective.showRelWords">
        <template v-if="word?.synos?.length">
          <div class="line-white my-3"></div>
          <div class="flex">
            <div class="label">{{ $t('synonyms') }}</div>
            <div class="flex flex-col gap-3">
              <div class="flex" v-for="item in word.synos">
                <div class="pos line-height-1.4rem!">{{ item.pos }}</div>
                <div>
                  <div class="cn anim" v-opacity="effective.showSentenceTranslation || showFullWord || showWordResult">
                    {{ item.cn }}
                  </div>
                  <div class="anim" v-opacity="!effective.dictation || showFullWord || showWordResult">
                    <template v-for="(i, j) in item.ws" :key="j">
                      <ClickableWord :word="i" />
                      <span v-if="j !== item.ws.length - 1"> / </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <div
        class="anim"
        v-opacity="
          ((effective.showEtymology || effective.showRelWords) || showFullWord || showWordResult) &&
          settingStore.showEtymologyAndRelWords
        "
      >
        <template v-if="word?.etymology?.length">
          <div class="line-white my-3"></div>
          <div class="flex">
            <div class="label">{{ $t('etymology') }}</div>
            <div class="text-base">
              <div class="mb-2" v-for="item in word.etymology">
                <div class="">{{ item.t }}</div>
                <div class="">{{ item.d }}</div>
              </div>
            </div>
          </div>
          <!--        <div class="line-white my-2"></div>-->
        </template>

        <template v-if="word?.relWords?.root">
          <div class="flex">
            <div class="label">{{ $t('related_words') }}</div>
            <div class="flex flex-col gap-3">
              <div v-if="word.relWords.root" class=" ">
                {{ $t('word_root') }}：<ClickableWord class="en" :word="word.relWords.root" />
              </div>
              <div class="flex" v-for="item in word.relWords.rels">
                <div class="pos">{{ item.pos }}</div>
                <div>
                  <div class="flex items-center gap-4" v-for="itemj in item.words">
                    <ClickableWord class="en" :word="itemj.c" />
                    <div class="cn">{{ itemj.cn }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
    <div
      v-if="!editingNote"
      class="cursor"
      :style="{
        top: cursor.top + 'px',
        left: cursor.left + 'px',
        height: isTypingSentence() ? '20px' : settingStore.fontSize.wordForeignFontSize + 'px',
      }"
    ></div>
    <WordLookupPopover />
  </div>
</template>

<style scoped lang="scss">
.dictation {
  border-bottom: 2px solid gray;
}

.typing-word {
  width: 100%;
  flex: 1;
  //overflow: auto;
  word-break: break-word;
  position: relative;
  color: var(--color-font-2);

  .phonetic,
  .translate {
    font-size: 1.2rem;
  }

  .phonetic {
    color: var(--color-font-1);
    font-family: var(--word-font-family);
  }

  .word {
    font-size: 3rem;
    line-height: 1;
    font-family: var(--en-article-family);
    letter-spacing: 0.3rem;
  }

  .is-wrong {
    animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  .input,
  .right {
    color: rgb(22, 163, 74);
  }

  .wrong {
    color: rgba(red, 0.6);
  }

  .tabs {
    @apply: text-lg font-medium;
    display: flex;
    gap: 2rem;

    .tab {
      cursor: pointer;

      &.active {
        border-bottom: 2px solid var(--color-font-2);
      }
    }
  }

  .label {
    width: 6rem;
    padding-top: 0.2rem;
    flex-shrink: 0;
  }

  .cn {
    @apply text-base;
  }

  .note-content {
    @apply text-base whitespace-pre-wrap;
  }

  .en {
    @apply text-lg;
  }

  .pos {
    @apply min-w-10;
  }

  .sentence {
    @apply rounded-lg px-3 py-2 -mx-3;
    background: transparent;
    transition: all .3s;
  }
  .sentence-highlight {
    background: rgba(124, 58, 237, 0.1);
    box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.25);
  }
}

// 移动端适配
@media (max-width: 768px) {
  .typing-word {
    .label {
      @apply w-unset mr-2;
    }
    :deep(.pos) {
      @apply w-unset mr-2 min-w-unset;
    }
  }
}
</style>
