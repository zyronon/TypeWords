<script setup lang="ts">
import type { Question, Word } from '../../types'
import { getDefaultWord, IdentifyMethod, ShortcutKey, WordPracticeType } from '../../types'
import { useBaseStore, useSettingStore } from '../../stores'
import {
  getBrowserKey,
  resetActiveWordPlayCount,
  usePlayBeep,
  usePlayCorrect,
  usePlayKeyboardAudio,
  usePlayWordAudio,
  useTTsPlayAudio,
} from '../../hooks/sound'
import { emitter, EventKey, useEventsByWatch } from '../../utils/eventBus'
import { onMounted, onUnmounted, watch } from 'vue'
import SentenceHightLightWord from './SentenceHightLightWord.vue'
import ClickableEnglishText from './ClickableEnglishText.vue'
import ClickableWord from './ClickableWord.vue'
import WordLookupPopover from './WordLookupPopover.vue'
import { _nextTick, last, normalizeWord, useNav } from '../../utils'
import { BaseButton, BaseIcon, Textarea, Toast, ToastComponent, Tooltip, VolumeIcon } from '@typewords/base'
import Space from '../article/Space.vue'
import { useI18n } from 'vue-i18n'
import { useWordOptions } from '../../hooks/dict.ts'
import { ref } from 'vue'
import TranslationList from './TranslationList.vue'
import { useRouter } from 'vue-router'
import { useOnKeyboardEventListener } from '../../hooks/event.ts'

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
//错误次数
let wrongTimes = ref(0)
//输入锁定，因为跳转到下一个单词有延时，如果重复在延时期间内重复输入，导致会跳转N次
let inputLock = false
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
const router = useRouter()

const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()
const playWordAudio = usePlayWordAudio()
const ttsPlayAudio = useTTsPlayAudio()

// 例句发音未配置声色时的一次性引导提示（每次页面加载只提示一次）
let ttsVoiceHintShown = false
function playTtsWithGuide(text: string) {
  if (!ttsVoiceHintShown) {
    const browserKey = getBrowserKey()
    const hasVoice = settingStore.ttsVoiceMap?.some(v => v.key === browserKey && v.voice)
    if (!hasVoice) {
      ttsVoiceHintShown = true
      let ins = Toast.warning(
        '例句默认使用浏览器内置 TTS 发音，若无声请前往「设置 → 音效设置 → TTS 声色」选择可用声色',
        {
          duration: 15000000,
          action: {
            text: '设置',
            onClick: () => {
              router.push('/setting?index=4')
              ins.close()
            },
          },
        }
      )
    }
  }
  ttsPlayAudio(text)
}

const volumeIconRef: any = $ref()
const sentenceVolumeIconsRefs: any = $ref([])
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

// 在全局对象中存储当前单词信息，以便其他模块可以访问
function updateCurrentWordInfo() {
  window.__CURRENT_WORD_INFO__ = {
    word: props.word.word,
    input: input,
    inputLock: inputLock,
    containsSpace: props.word.word.includes(' '),
  }
}

watch(() => props.word, reset)

function reset() {
  clearJumpTimer()
  wrong = input = ''
  wordRepeatCount = 0
  showWordResult.value = inputLock = completeSelect = showAllCandidates = false
  editingNote = false
  noteInputValue = ''
  currentPracticeSentenceIndex = -1
  wordCompletedTime = 0 // 重置时间戳
  wrongTimes.value = 0
  resetActiveWordPlayCount(props.word.word)
  if (settingStore.wordSound) {
    if (settingStore.wordPracticeType !== WordPracticeType.Dictation) {
      volumeIconRef?.play(false, true)
    }
  }
  // 更新当前单词信息
  updateCurrentWordInfo()
  checkCursorPosition()
}

// 监听输入变化，更新当前单词信息
watch(
  () => input,
  () => {
    updateCurrentWordInfo()
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
  updateCurrentWordInfo()

  emitter.on(EventKey.resetWord, reset)
  emitter.on(EventKey.onTyping, onTyping)
})

onUnmounted(() => {
  clearJumpTimer()
  emitter.off(EventKey.resetWord, reset)
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

    if (settingStore.wordSound) volumeIconRef?.play()
  }, settingStore.waitTimeForChangeWord)
}

let showWordResult = ref(false)
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
      if (settingStore.wordSound) volumeIconRef?.play()
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
            playCorrect()
            if (settingStore.wordSound) targetVolumeIcon?.play()
          }
        } else {
          //错误处理
          playBeep()
          if (settingStore.wordSound) targetVolumeIcon?.play()
          typo()
        }
        showWordResult.value = true
        return
      }
    }
    //默写途中不判断是否正确，在按空格再判断
    input += letter
    wrong = ''
    playKeyboardAudio()
    updateCurrentWordInfo()
    inputLock = false
  } else if (settingStore.wordPracticeType === WordPracticeType.Identify && !showWordResult.value) {
    //当自测模式下，按其他键则自动默认为不认识
    showWordResult.value = true
    typo()
    if (settingStore.wordSound) targetVolumeIcon?.play()
    inputLock = false
    onTyping(e)
  } else {
    let right = false
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
      inputLock = false
    } else {
      typo()
      wrong = letter
      playBeep()
      if (settingStore.wordSound) targetVolumeIcon?.play()
      setTimeout(() => {
        if (settingStore.inputWrongClear && !isTypingSentence()) input = ''
        wrong = ''
        inputLock = false
      }, 500)
    }
    // 更新当前单词信息
    updateCurrentWordInfo()
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
      if (settingStore.wordSound) volumeIconRef?.play()
    }
  } else {
    if (wrong) {
      wrong = ''
    } else {
      input = input.slice(0, -1)
    }
  }
  // 更新当前单词信息
  updateCurrentWordInfo()
}

function showWord() {
  if (settingStore.allowWordTip) {
    //如果不是跟写模式，查看单词一律标记为错词
    if (settingStore.wordPracticeType !== WordPracticeType.FollowWrite || settingStore.dictation) {
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
  if (settingStore.wordPracticeType === WordPracticeType.Dictation || settingStore.dictation) {
    if (!showWordResult.value && !right) {
      //输入完成，或者已显示的情况下，不记入错误
      typo()
    }
  }
}

function play() {
  checkIsWrong()
  volumeIconRef?.play(true)
}

defineExpose({ del, showWord, hideWord, play, showWordResult, wrongTimes })

function mouseleave() {
  setTimeout(() => {
    showFullWord = false
  }, 50)
}

watch([() => input, () => showFullWord, () => settingStore.dictation], checkCursorPosition)

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

const { isWordCollect, toggleWordCollect, isWordSimple, toggleWordSimple } = useWordOptions()

const isSimple = $computed(() => isWordSimple(props.word))
const isCollect = $computed(() => isWordCollect(props.word))
</script>

<template>
  <div class="typing-word" ref="typingWordRef" v-if="word.word.length">
    <div class="flex flex-col items-center">
      <div class="flex gap-1 mt-10 md:mt-30">
        <div
          class="phonetic"
          :class="
            (settingStore.dictation ||
              [WordPracticeType.Spell, WordPracticeType.Listen, WordPracticeType.Dictation].includes(
                settingStore.wordPracticeType
              )) &&
            !showFullWord &&
            !showWordResult &&
            'word-shadow'
          "
          v-if="settingStore.soundType === 'uk' && word.phonetic0"
        >
          / {{ word.phonetic0 }} /
        </div>
        <div
          class="phonetic"
          :class="
            (settingStore.dictation ||
              [WordPracticeType.Spell, WordPracticeType.Listen, WordPracticeType.Dictation].includes(
                settingStore.wordPracticeType
              )) &&
            !showFullWord &&
            !showWordResult &&
            'word-shadow'
          "
          v-if="settingStore.soundType === 'us' && word.phonetic1"
        >
          / {{ word.phonetic1 }} /
        </div>
        <VolumeIcon
          :title="`发音(${settingStore.shortcutKeyMap[ShortcutKey.PlayWordPronunciation]})`"
          ref="volumeIconRef"
          :simple="true"
          @click="checkIsWrong"
          :cb="active => playWordAudio(word.word, active)"
        />
      </div>

      <Tooltip
        :title="settingStore.dictation ? `快捷键 ${settingStore.shortcutKeyMap[ShortcutKey.ShowWord]} 显示单词` : ''"
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
              v-opacity="!settingStore.dictation || showWordResult || showFullWord"
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
              <span class="letter" v-if="settingStore.dictation && !showFullWord">
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
        <BaseIcon
          @click="toggleWordCollect(word)"
          :title="
            (!isCollect ? $t('collect') : $t('uncollect')) +
            `(${settingStore.shortcutKeyMap[ShortcutKey.ToggleCollect]})`
          "
        >
          <IconFluentStarAdd16Regular v-if="!isCollect" />
          <IconFluentStar16Filled v-else />
        </BaseIcon>
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
        v-opacity="settingStore.translate || showWordResult || showFullWord"
        :style="{
          fontSize: settingStore.fontSize.wordTranslateFontSize + 'px',
        }"
      >
        <TranslationList :word="word" :showFull="!settingStore.dictation || showWordResult || showFullWord" />
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
      v-opacity="
        ![WordPracticeType.Listen, WordPracticeType.Dictation, WordPracticeType.Identify].includes(
          settingStore.wordPracticeType
        ) ||
        showFullWord ||
        showWordResult
      "
    >
      <template v-if="word?.sentences?.length">
        <div class="line-white my-3"></div>
        <div class="flex flex-col gap-3">
          <div
            class="sentence"
            :class="wrong && currentPracticeSentenceIndex === index ? 'is-wrong' : ''"
            v-for="(item, index) in word.sentences"
          >
            <div class="flex gap-space text-xl">
              <div v-if="index !== currentPracticeSentenceIndex">
                <ClickableEnglishText
                  :text="item.c"
                  :word="word.word"
                  :dictation="!(!settingStore.dictation || showFullWord || showWordResult)"
                />
              </div>
              <div v-else>
                <span class="input" v-if="input">{{ input }}</span>
                <span class="wrong" v-if="wrong">{{ wrong }}</span>
                <span class="letter">{{ displaySentence }}</span>
              </div>
              <VolumeIcon
                :title="`发音`"
                :simple="false"
                :cb="() => playTtsWithGuide(item.c)"
                ref="sentenceVolumeIconsRefs"
              />
            </div>
            <div class="text-base anim" v-opacity="settingStore.translate || showFullWord || showWordResult">
              {{ item.cn }}
            </div>
          </div>
        </div>
      </template>

      <template v-if="word?.phrases?.length">
        <div class="line-white my-3"></div>
        <div class="flex">
          <div class="label">{{ $t('phrases') }}</div>
          <div class="flex flex-col">
            <div class="flex items-center gap-4" v-for="item in word.phrases">
              <ClickableEnglishText
                class="en"
                :text="item.c"
                :word="word.word"
                :dictation="!(!settingStore.dictation || showFullWord || showWordResult)"
              />
              <div class="cn anim" v-opacity="settingStore.translate || showFullWord || showWordResult">
                {{ item.cn }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="settingStore.translate || !settingStore.dictation">
        <template v-if="word?.synos?.length">
          <div class="line-white my-3"></div>
          <div class="flex">
            <div class="label">{{ $t('synonyms') }}</div>
            <div class="flex flex-col gap-3">
              <div class="flex" v-for="item in word.synos">
                <div class="pos line-height-1.4rem!">{{ item.pos }}</div>
                <div>
                  <div class="cn anim" v-opacity="settingStore.translate || showFullWord || showWordResult">
                    {{ item.cn }}
                  </div>
                  <div class="anim" v-opacity="!settingStore.dictation || showFullWord || showWordResult">
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
          ((settingStore.translate && !settingStore.dictation) || showFullWord || showWordResult) &&
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
