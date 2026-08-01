<script setup lang="ts">
/**
 * TypeWordV2 — 单词练习外壳组件
 *
 * 此组件负责：
 * - 布局容器编排（组合 WordTypingCoreV2 / WordIdentifyPanelV2 / WordMetaPanelV2）
 * - effective 显示策略计算
 * - 笔记 / 收藏 / 操作按钮
 * - 提示 Toast（按空格 / 按删除）
 * - defineExpose 透传
 *
 * 子组件：
 * - WordTypingCoreV2：纯键入引擎
 * - WordIdentifyPanelV2：自测 / WordTest UI
 * - WordMetaPanelV2：音标 / 翻译 / 例句 / 短语 / 词源
 */
import type { Question, Word } from '@typewords/core/types/types.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import { IdentifyMethod, ShortcutKey, WordPracticeType } from '@typewords/core/types/enum.ts'
import { useBaseStore } from '@typewords/core/stores/base.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { cancelWordPracticeAudio, usePlayBeep, usePlayCorrect, usePlayWordAudio } from '@typewords/core/hooks/sound.ts'
import { useInjectedDisplayPolicy } from '~/composables/practice-words/usePracticeDisplayPolicy.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import WordLookupPopover from '@typewords/core/components/word/WordLookupPopover.vue'
import { BaseButton, BaseIcon, Textarea, Toast, ToastComponent, Tooltip, VolumeIcon } from '@typewords/base'
import { useI18n } from 'vue-i18n'
import { useWordOptions } from '@typewords/core/hooks/dict.ts'
import { openWordCollectPicker } from '@typewords/core/hooks/useWordCollectPicker.ts'
import WordTypingCoreV2 from './WordTypingCoreV2.vue'
import WordIdentifyPanelV2 from './WordIdentifyPanelV2.vue'
import WordMetaPanelV2 from './WordMetaPanelV2.vue'
import { useOnKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import { WordPlayTrigger } from '@typewords/core/composables/useWordPracticeAudio.ts'

const { t: $t } = useI18n()

interface IProps {
  word: Word
  question?: Question | null
  /** 当前 Cursor 解析出的真实练习类型。 */
  practiceType: WordPracticeType
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

const settingStore = useSettingStore()
const store = useBaseStore()

// ============ 音频 ============

const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playWordAudio = usePlayWordAudio()

const volumeIconRef: any = $ref()
let isTypingWord = $ref(true)
let isPlayedFirstSentence = false

// ============ 共享状态 ============
let showFullWord = $ref(false)
let showWordResult = $ref(false)
const wrongTimesModel = ref(0)

const localReveal = computed(() => ({
  showFullWord,
  showWordResult,
}))
const effective = useInjectedDisplayPolicy(localReveal)

const typingCoreRef = $ref<InstanceType<typeof WordTypingCoreV2>>()
const identifyPanelRef = $ref<InstanceType<typeof WordIdentifyPanelV2>>()
const wordMetaPanelRef = $ref<InstanceType<typeof WordMetaPanelV2>>()

function shouldPlayFirstSentence() {
  return (
    settingStore.autoPlayFirstSentence &&
    [WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(props.practiceType) &&
    !!props.word.sentences?.[0]?.c &&
    !isPlayedFirstSentence
  )
}

function playWord(trigger: WordPlayTrigger) {
  const handle = trigger === WordPlayTrigger.Manual
  if (handle || settingStore.wordSound) {
    if (handle) cancelWordPracticeAudio()
    const chainWord = shouldPlayFirstSentence() ? props.word.word : ''
    const onEnd = chainWord
      ? () => {
          if (props.word.word === chainWord) {
            isPlayedFirstSentence = true
            wordMetaPanelRef?.playSentence(0, { highlight: true })
          }
        }
      : undefined
    playWordAudio(props.word.word, handle, onEnd, () => {
      volumeIconRef?.animate(true)
    })
  }
}

function onTypingCoreComplete() {
  if (settingStore.practiceSentence && props.word.sentences.length) {
    isTypingWord = false
    return wordMetaPanelRef.startPracticeSentence()
  }
  emit('complete')
}

function onTypingCoreWrong() {
  emit('wrong')
}

function onSentencePracticeComplete() {
  isTypingWord = true
  emit('complete')
}

// ============ 单词操作 ============
function checkIsWrong() {
  if (effective.value.isWordMasked) {
    if (!showWordResult && !typingCoreRef?.right) {
      emit('wrong')
    }
  }
}

function onVolumeIconClick() {
  checkIsWrong()
  playWord(WordPlayTrigger.Manual)
}

function showWord() {
  if (!settingStore.allowWordTip) return

  // 如果不是跟写模式，查看单词一律标记为错词
  if (props.practiceType !== WordPracticeType.FollowWrite || effective.value.isWordMasked) {
    // 原版 typo() 无条件调用
    if (!showWordResult) {
      emit('wrong')
    }
  }
  if (
    props.practiceType === WordPracticeType.Identify &&
    settingStore.identifyMethod === IdentifyMethod.WordTest &&
    identifyPanelRef
  ) {
    identifyPanelRef.showAllCandidates = true
  }
  showFullWord = true
}

function hideWord() {
  if (identifyPanelRef) identifyPanelRef.showAllCandidates = false
  showFullWord = false
}

function play() {
  volumeIconRef?.play()
}

function mouseleave() {
  setTimeout(() => {
    showFullWord = false
  }, 50)
}

// ============ 笔记 ============

let editingNote = $ref(false)
let noteInputValue = $ref('')

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

// ============ 收藏 / 简词 ============

const { isWordSimple, toggleWordSimple } = useWordOptions()

const collectAnchorRef = ref<HTMLElement | null>(null)

function openCollectPicker(e: MouseEvent) {
  e.stopPropagation()
  openWordCollectPicker(props.word, e.currentTarget as HTMLElement, {
    excludeDictId: store.sdict.id ? String(store.sdict.id) : undefined,
  })
}

const isSimple = $computed(() => isWordSimple(props.word))

// ============ 自测/WordTest 事件处理 ============

const isWordTestVal = computed(() => {
  return props.practiceType === WordPracticeType.Identify && settingStore.identifyMethod === IdentifyMethod.WordTest
})

let showNotice = false

function onIdentifyKnow() {
  if (isWordTestVal.value) {
    // WordTest 选对
    typingCoreRef?.setWordTestResult?.(true, props.word.word)
    playCorrect()
    emit('know')

    if (!showNotice) {
      Toast.info($t('press_space_continue'), { duration: 5000 })
      showNotice = true
    }
    return
  }
  // SelfAssessment "认识"
  if (!showWordResult) {
    showWordResult = true
    typingCoreRef?.revealWord?.(props.word.word)
    emit('know')
    if (!showNotice) {
      Toast.info($t('know_word_tip'), { duration: 5000 })
      showNotice = true
    }
  }
}

function onIdentifyWrong() {
  if (isWordTestVal.value) {
    // WordTest 选错
    typingCoreRef?.setWordTestResult?.(false, props.word.word)
    playBeep()
    emit('wrong')
    playWord(WordPlayTrigger.Typo)

    if (!showNotice) {
      Toast.info($t('press_space_continue'), { duration: 5000 })
      showNotice = true
    }
    return
  }
  // 其他情况透传
  emit('wrong')
}

function onIdentifyUnknown() {
  if (!showWordResult) {
    showWordResult = true
    emit('wrong')
    playWord(WordPlayTrigger.Typo)
  }
}

function onIdentifyMastered() {
  emit('mastered')
}

// ============ 提示 Toast ============

const notice = $computed(() => {
  let text =
    props.practiceType === WordPracticeType.Identify
      ? '选择后/输入后，按空格键切换下一个'
      : props.practiceType === WordPracticeType.Listen
        ? '输入完成后按空格键切换下一个'
        : showWordResult
          ? typingCoreRef?.isWordRight()
            ? '按空格键切换下一个'
            : $t('press_delete_reinput')
          : '按空格键完成输入'
  return {
    show: [WordPracticeType.Listen, WordPracticeType.Identify, WordPracticeType.Dictation].includes(props.practiceType),
    text,
  }
})

// ============ 重置：单词切换时 reset identify / note 状态 ============

watch(() => props.word, onResetWord)

onMounted(() => {
  emitter.on(EventKey.resetWord, onResetWord)
})

onUnmounted(() => {
  emitter.off(EventKey.resetWord, onResetWord)
})

// keyup 时隐藏单词
useOnKeyboardEventListener(
  () => {},
  () => {
    hideWord()
  }
)

function onResetWord() {
  isTypingWord = true
  showFullWord = false
  isPlayedFirstSentence = false
  showWordResult = false
  if (identifyPanelRef) identifyPanelRef.resetIdentifyState?.()
  editingNote = false
  noteInputValue = ''
}

// ============ defineExpose ============

defineExpose({
  showWord,
  play,
  getCollectAnchor: () => collectAnchorRef.value,
})
</script>

<template>
  <div class="typing-word" v-if="word.word.length">
    <div class="flex flex-col items-center">
      <!-- 音标 + 发音按钮（通过 slot 传入 VolumeIcon） -->
      <div class="flex gap-1 mt-10 md:mt-30">
        <div
          class="phonetic"
          :class="effective.isWordMasked && 'word-shadow'"
          v-if="settingStore.soundType === 'uk' && word.phonetic0"
        >
          / {{ word.phonetic0 }} /
        </div>
        <div
          class="phonetic"
          :class="effective.isWordMasked && 'word-shadow'"
          v-if="settingStore.soundType === 'us' && word.phonetic1"
        >
          / {{ word.phonetic1 }} /
        </div>
        <VolumeIcon
          :title="`发音(${settingStore.shortcutKeyMap[ShortcutKey.PlayWordPronunciation]})`"
          ref="volumeIconRef"
          :cb="onVolumeIconClick"
        />
      </div>

      <!-- 单词键入区 -->
      <Tooltip
        :title="effective.isWordMasked ? `快捷键 ${settingStore.shortcutKeyMap[ShortcutKey.ShowWord]} 显示单词` : ''"
      >
        <div
          id="word"
          class="word my-1"
          :style="{ fontSize: settingStore.fontSize.wordForeignFontSize + 'px' }"
          @mouseenter="showWord"
          @mouseleave="mouseleave"
        >
          <WordTypingCoreV2
            ref="typingCoreRef"
            :word="word"
            :active="isTypingWord && !isWordTestVal && !editingNote"
            :practiceType="practiceType"
            :isWordMasked="effective.isWordMasked"
            v-model:showWordResult="showWordResult"
            v-model:wrongTimes="wrongTimesModel"
            :showFullWord="showFullWord"
            :wordFontSize="settingStore.fontSize.wordForeignFontSize"
            :playWord="playWord"
            @complete="onTypingCoreComplete"
            @wrong="onTypingCoreWrong"
          />
        </div>
      </Tooltip>

      <!-- 操作按钮行 -->
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

      <!-- 自测 / WordTest UI -->
      <WordIdentifyPanelV2
        ref="identifyPanelRef"
        :word="word"
        :question="question"
        :practiceType="practiceType"
        :showWordResult="showWordResult"
        @know="onIdentifyKnow"
        @unknown="onIdentifyUnknown"
        @mastered="onIdentifyMastered"
        @wrong="onIdentifyWrong"
      />

      <!-- 笔记编辑区 -->
      <template v-if="editingNote || store.noteData[word.word]?.trim()">
        <div class="flex flex-col gap-2 w-full mt-4">
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
        <div class="line-white my-3"></div>
      </template>

      <!-- 提示 Toast -->
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

      <!-- WordMetaPanelV2: 翻译 + 例句 + 短语 + 词源 等展示 -->
      <WordMetaPanelV2
        :key="word.word"
        ref="wordMetaPanelRef"
        :word="word"
        @complete="onSentencePracticeComplete"
        :effective="effective"
        @wrong="emit('wrong')"
      />
    </div>
    <WordLookupPopover />
  </div>
</template>

<style scoped lang="scss">
.typing-word {
  width: 100%;
  flex: 1;
  word-break: break-word;
  position: relative;
  color: var(--color-font-2);

  .phonetic {
    color: var(--color-font-1);
    font-family: var(--word-font-family);
    font-size: 1.2rem;
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

  .label {
    width: 6rem;
    padding-top: 0.2rem;
    flex-shrink: 0;
  }

  .note-content {
    @apply text-base whitespace-pre-wrap;
  }
}

// 移动端适配
@media (max-width: 768px) {
  .typing-word {
    .label {
      @apply w-unset mr-2;
    }
  }
}
</style>
