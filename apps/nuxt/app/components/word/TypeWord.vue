<script setup lang="ts">
import type { Word } from '~/types/types'
import VolumeIcon from '~/components/icon/VolumeIcon.vue'
import { useSettingStore } from '~/stores/setting'
import { usePlayBeep, usePlayCorrect, usePlayKeyboardAudio, usePlayWordAudio, useTTsPlayAudio } from '~/hooks/sound'
import { emitter, EventKey, useEvents } from '~/utils/eventBus'
import { onMounted, onUnmounted, watch } from 'vue'
import SentenceHightLightWord from '~/components/word/SentenceHightLightWord.vue'
import { usePracticeStore } from '~/stores/practice'
import { getDefaultWord } from '~/types/func'
import { _nextTick, last } from '~/utils'
import BaseButton from '~/components/BaseButton.vue'
import Space from '~/components/article/Space.vue'
import Toast from '~/components/base/toast/Toast'
import Tooltip from '~/components/base/Tooltip.vue'
import { ShortcutKey, WordPracticeStage, WordPracticeType } from '~/types/enum'
import { useI18n } from 'vue-i18n'
const { t: $t } = useI18n()

interface IProps {
  word: Word
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
})

const emit = defineEmits<{
  complete: []
  wrong: []
  know: []
}>()

let input = $ref('')
let wrong = $ref('')
let showFullWord = $ref(false)
//输入锁定，因为跳转到下一个单词有延时，如果重复在延时期间内重复输入，导致会跳转N次
let inputLock = false
let wordRepeatCount = 0
// 记录单词完成的时间戳，用于防止同时按下最后一个字母和空格键时跳过单词
let wordCompletedTime = 0
let jumpTimer = -1
let cursor = $ref({
  top: 0,
  left: 0,
})
const settingStore = useSettingStore()
const statStore = usePracticeStore()
const store = useBaseStore()

const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()
const playWordAudio = usePlayWordAudio()
const ttsPlayAudio = useTTsPlayAudio()
const volumeIconRef: any = $ref()
const sentenceVolumeIconsRefs: any = $ref([])
const typingWordRef = $ref<HTMLDivElement>()
// const volumeTranslateIconRef: any = $ref()

let displayWord = $computed(() => {
  return props.word.word.slice(input.length + wrong.length)
})
let displaySentence = $computed(() => {
  return props.word.sentences[currentPracticeSentenceIndex].c.slice(input.length + wrong.length)
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

watch(() => props.word, reset, { deep: true })

function reset() {
  wrong = input = ''
  wordRepeatCount = 0
  showWordResult = inputLock = false
  currentPracticeSentenceIndex = -1
  wordCompletedTime = 0 // 重置时间戳
  if (settingStore.wordSound) {
    if (settingStore.wordPracticeType !== WordPracticeType.Dictation) {
      volumeIconRef?.play(400, true)
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

onMounted(() => {
  // 初始化当前单词信息
  updateCurrentWordInfo()

  emitter.on(EventKey.resetWord, reset)
  emitter.on(EventKey.onTyping, onTyping)
})

onUnmounted(() => {
  emitter.off(EventKey.resetWord)
  emitter.off(EventKey.onTyping, onTyping)
})

function repeat() {
  setTimeout(() => {
    wrong = input = ''
    wordRepeatCount++
    inputLock = false

    if (settingStore.wordSound) volumeIconRef?.play()
  }, settingStore.waitTimeForChangeWord)
}

let showWordResult = $ref(false)
let pressNumber = 0

const right = $computed(() => {
  let target
  if (currentPracticeSentenceIndex === -1) {
    target = props.word.word
  } else {
    target = props.word.sentences[currentPracticeSentenceIndex].c
  }
  if (settingStore.ignoreCase) {
    return input.toLowerCase() === target.toLowerCase()
  } else {
    return input === target
  }
})

let showNotice = false

function know(e) {
  if (settingStore.wordPracticeType === WordPracticeType.Identify) {
    if (!showWordResult) {
      inputLock = showWordResult = true
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

function unknown(e) {
  if (settingStore.wordPracticeType === WordPracticeType.Identify) {
    if (!showWordResult) {
      showWordResult = true
      emit('wrong')
      if (settingStore.wordSound) volumeIconRef?.play()
      return
    }
  }
  onTyping(e)
}

let currentPracticeSentenceIndex = $ref(-1)

async function onTyping(e: KeyboardEvent) {
  debugger
  let target
  let targetVolumeIcon
  if (currentPracticeSentenceIndex == -1) {
    target = props.word.word
    targetVolumeIcon = volumeIconRef
  } else {
    target = props.word.sentences[currentPracticeSentenceIndex].c
    targetVolumeIcon = sentenceVolumeIconsRefs[currentPracticeSentenceIndex]
  }
  // 输入完成会锁死不能再输入
  if (inputLock) {
    //判断是否是空格键以便切换到下一个
    if (e.code === 'Space') {
      //正确时就切换到下一个
      if (right) {
        clearInterval(jumpTimer)
        // 如果单词刚完成（300ms内），忽略空格键，避免同时按下最后一个字母和空格键时跳过
        if (wordCompletedTime && Date.now() - wordCompletedTime < 300) {
          return
        }
        showWordResult = inputLock = false
        completeTypeWord(false)
      } else {
        if (showWordResult) {
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
        showWordResult = inputLock = false
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
        if (input.toLowerCase() === target.toLowerCase()) {
          //如果已显示单词，则发射完成事件，并 return
          if (showWordResult) {
            return emit('complete')
          } else {
            //未显示单词，则播放正确音乐，并在后面设置为 showWordResult 为 true 来显示单词
            playCorrect()
            if (settingStore.wordSound) targetVolumeIcon?.play()
          }
        } else {
          //错误处理
          playBeep()
          if (settingStore.wordSound) targetVolumeIcon?.play()
          emit('wrong')
        }
        showWordResult = true
        return
      }
    }
    //默写途中不判断是否正确，在按空格再判断
    input += letter
    wrong = ''
    playKeyboardAudio()
    updateCurrentWordInfo()
    inputLock = false
  } else if (settingStore.wordPracticeType === WordPracticeType.Identify && !showWordResult) {
    //当自测模式下，按1和2会单独处理，如果按其他键则自动默认为不认识
    showWordResult = true
    emit('wrong')
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
        ('：' === target[input.length] && e.code === 'Semicolon') ||
        ('）' === target[input.length] && e.code === 'Digit0'))
    ) {
      right = true
      letter = target[input.length]
    }
    if (
      !e.shiftKey &&
      (('【' === target[input.length] && e.code === 'BracketLeft') ||
        ('、' === target[input.length] && e.code === 'Slash') ||
        ('。' === target[input.length] && e.code === 'Period') ||
        ('，' === target[input.length] && e.code === 'Comma') ||
        ('‘' === target[input.length] && e.code === 'Quote') ||
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
      emit('wrong')
      wrong = letter
      playBeep()
      if (settingStore.wordSound) targetVolumeIcon?.play()
      setTimeout(() => {
        if (settingStore.inputWrongClear) input = ''
        wrong = ''
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
        !showWordResult
      ) {
        showWordResult = true
      }
      if ([WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(settingStore.wordPracticeType)) {
        if (settingStore.autoNextWord) {
          completeTypeWord(true)
        }
      }
    } else {
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

function completeTypeWord(delay: boolean) {
  if (settingStore.wordPracticeType === WordPracticeType.FollowWrite && settingStore.practiceSentence) {
    currentPracticeSentenceIndex++
    if (currentPracticeSentenceIndex < props.word.sentences.length) {// 还有下一个句子
      inputLock = false
      wrong = input = ''
      return
    }
  }
  if (shouldRepeat()) {
    repeat()
  } else {
    if (delay) {
      jumpTimer = setTimeout(() => emit('complete'), settingStore.waitTimeForChangeWord)
    } else {
      emit('complete')
    }
  }
}

function del() {
  playKeyboardAudio()
  inputLock = false
  if (showWordResult) {
    input = ''
    showWordResult = false
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
      emit('wrong')
    }
    showFullWord = true
  }
}

function hideWord() {
  showFullWord = false
}

function play() {
  if (settingStore.wordPracticeType === WordPracticeType.Dictation || settingStore.dictation) {
    emit('wrong')
  }
  volumeIconRef?.play()
}

defineExpose({ del, showWord, hideWord, play })

function mouseleave() {
  setTimeout(() => {
    showFullWord = false
  }, 50)
}

// 在释义中隐藏单词本身及其变形
function hideWordInTranslation(text: string, word: string): string {
  if (!text || !word) {
    return text
  }

  // 创建正则表达式，匹配单词本身及其常见变形（如复数、过去式等）
  const wordBase = word.toLowerCase()
  const patterns = [
    `\\b${escapeRegExp(wordBase)}\\b`, // 单词本身
    `\\b${escapeRegExp(wordBase)}s\\b`, // 复数形式
    `\\b${escapeRegExp(wordBase)}es\\b`, // 复数形式
    `\\b${escapeRegExp(wordBase)}ed\\b`, // 过去式
    `\\b${escapeRegExp(wordBase)}ing\\b`, // 进行时
  ]

  let result = text
  patterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'gi')
    result = result.replace(regex, match => `<span class="word-shadow">${match}</span>`)
  })

  return result
}

// 转义正则表达式特殊字符
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

watch([() => input, () => showFullWord, () => settingStore.dictation], checkCursorPosition)

//检测光标位置
function checkCursorPosition() {
  _nextTick(() => {
    // 选中目标元素
    const cursorEl = document.querySelector(`.cursor`)
    const inputList = document.querySelectorAll(`.l`)
    if (!typingWordRef) return
    const typingWordRect = typingWordRef.getBoundingClientRect()

    if (inputList.length) {
      let inputRect = last(Array.from(inputList)).getBoundingClientRect()
      cursor = {
        top: inputRect.top + inputRect.height - cursorEl.clientHeight - typingWordRect.top,
        left: inputRect.right - typingWordRect.left - 3,
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
        top: elRect.top + elRect.height - cursorEl.clientHeight - typingWordRect.top,
        left: elRect.left - typingWordRect.left - 3,
      }
    }
  })
}

useEvents([
  [ShortcutKey.KnowWord, know],
  [ShortcutKey.UnknownWord, unknown],
])

const notice = $computed(() => {
  let text =
    settingStore.wordPracticeType === WordPracticeType.Identify
      ? '选择后/输入后，按空格键切换下一个'
      : settingStore.wordPracticeType === WordPracticeType.Listen
        ? '输入完成后按空格键切换下一个'
        : showWordResult
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
</script>

<template>
  <div class="typing-word" ref="typingWordRef" v-if="word.word.length">
    <div class="flex flex-col items-center">
      <div class="flex gap-1 mt-30">
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
          [{{ word.phonetic0 }}]
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
          [{{ word.phonetic1 }}]
        </div>
        <VolumeIcon
          :title="`发音(${settingStore.shortcutKeyMap[ShortcutKey.PlayWordPronunciation]})`"
          ref="volumeIconRef"
          :simple="true"
          :cb="() => playWordAudio(word.word)"
        />
      </div>

      <Tooltip
        :title="settingStore.dictation ? `快捷键 ${settingStore.shortcutKeyMap[ShortcutKey.ShowWord]} 显示单词` : ''"
      >
        <div
          id="word"
          class="word my-1"
          :class="(wrong && currentPracticeSentenceIndex === -1) ? 'is-wrong' : ''"
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

      <div
        class="mt-4 flex gap-4"
        v-if="settingStore.wordPracticeType === WordPracticeType.Identify && !showWordResult"
      >
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
      </div>

      <div class="center my-5" v-if="notice.show && settingStore.showUsageTips">
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
        <div class="flex" v-for="v in word.trans">
          <div class="shrink-0" :class="v.pos ? 'w-12 en-article-family' : '-ml-3'">
            {{ v.pos }}
          </div>
          <span v-if="!settingStore.dictation || showWordResult || showFullWord">{{ v.cn }}</span>
          <span v-else v-html="hideWordInTranslation(v.cn, word.word)"></span>
        </div>
      </div>
    </div>

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
            :class="(wrong && currentPracticeSentenceIndex === index) ? 'is-wrong' : ''" 
            v-for="(item, index) in word.sentences"
          >
            <div class="flex gap-space text-xl">
              <div v-if="index !== currentPracticeSentenceIndex">
                <SentenceHightLightWord
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
            </div>
            <VolumeIcon :title="`发音`" :simple="false" :cb="() => ttsPlayAudio(item.c)" ref="sentenceVolumeIconsRefs" />
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
              <SentenceHightLightWord
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
                    <span class="en" v-for="(i, j) in item.ws">
                      {{ i }} {{ j !== item.ws.length - 1 ? ' / ' : '' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <div
        class="anim"
        v-opacity="(settingStore.translate && !settingStore.dictation) || showFullWord || showWordResult"
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

        <template v-if="word?.relWords?.root && false">
          <div class="flex">
            <div class="label">{{ $t('related_words') }}</div>
            <div class="flex flex-col gap-3">
              <div v-if="word.relWords.root" class=" ">
                {{ $t('word_root') }}：<span class="en">{{ word.relWords.root }}</span>
              </div>
              <div class="flex" v-for="item in word.relWords.rels">
                <div class="pos">{{ item.pos }}</div>
                <div>
                  <div class="flex items-center gap-4" v-for="itemj in item.words">
                    <div class="en">{{ itemj.c }}</div>
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
      class="cursor"
      :style="{
        top: cursor.top + 'px',
        left: cursor.left + 'px',
        height: currentPracticeSentenceIndex === -1 ? settingStore.fontSize.wordForeignFontSize + 'px' : '20px',
      }"
    ></div>
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

  .en {
    @apply text-lg;
  }

  .pos {
    font-family: var(--en-article-family);
    @apply text-lg w-12;
  }
}

// 移动端适配
@media (max-width: 768px) {
  .typing-word {
    padding: 0 0.5rem 12rem;

    .word {
      font-size: 2rem !important;
      letter-spacing: 0.1rem;
      margin: 0.5rem 0;
    }

    .phonetic,
    .translate {
      font-size: 1rem;
    }

    .label {
      width: 4rem;
      font-size: 0.9rem;
    }

    .cn {
      font-size: 0.9rem;
    }

    .en {
      font-size: 1rem;
    }

    .pos {
      font-size: 0.9rem;
      width: 3rem;
    }

    // 移动端按钮组调整
    .flex.gap-4 {
      flex-direction: column;
      width: 100%;
      gap: 0.5rem;
      position: relative;
      z-index: 10; // 确保按钮不被其他元素遮挡

      .base-button {
        width: 100%;
        min-height: 48px;
        padding: 0.8rem;
        font-size: 1.1rem;
        font-weight: 500;
        cursor: pointer;
      }
    }

    // 确保短语和例句区域保持默认层级
    .phrase-section,
    .sentence {
      position: relative;
      z-index: auto;
    }

    // 移动端例句和短语调整
    .sentence,
    .phrase {
      font-size: 0.9rem;
      line-height: 1.4;
      margin-bottom: 0.5rem;
      pointer-events: auto; // 允许点击但不调起输入法
    }

    // 移动端短语调整
    .flex.items-center.gap-4 {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .typing-word {
    padding: 0 0.3rem 12rem;

    .word {
      font-size: 1.5rem !important;
      letter-spacing: 0.05rem;
      margin: 0.3rem 0;
    }

    .phonetic,
    .translate {
      font-size: 0.9rem;
    }

    .label {
      width: 3rem;
      font-size: 0.8rem;
    }

    .cn {
      font-size: 0.8rem;
    }

    .en {
      font-size: 0.9rem;
    }

    .pos {
      font-size: 0.8rem;
      width: 2.5rem;
    }

    .sentence {
      font-size: 0.8rem;
      line-height: 1.3;
    }
  }
}
</style>
