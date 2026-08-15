<script setup lang="ts">
/**
 * 单词练习外壳组件
 * 此组件负责：
 * - 布局容器编排（组合 WordTypingCore / WordIdentifyPanel / WordMetaPanel）
 * - effective 显示策略计算
 * - 笔记 / 收藏 / 操作按钮
 * - 提示 Toast（按空格 / 按删除）
 * - defineExpose 透传
 *
 * 子组件：
 * - WordTypingCore：纯键入引擎
 * - WordIdentifyPanel：自测 / WordTest UI
 * - WordMetaPanel：音标 / 翻译 / 例句 / 短语 / 词源
 */
import type { Question, Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { ShortcutKey, WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { usePlayWordAudio } from '@/core/hooks/sound.ts'
import { useInjectedDisplayPolicy } from '@/core/composables/practice-words/usePracticeDisplayPolicy.ts'
import { EventKey, useEvents } from '@/core/utils/eventBus.ts'
import { computed, ref, watch } from 'vue'
import WordLookupPopover from '@/components/word/WordLookupPopover.vue'
import { BaseButton, BaseIcon, Textarea, Toast, ToastComponent, Tooltip, VolumeIcon } from '@/base'
import { useI18n } from 'vue-i18n'
import { useWordOptions } from '@/core/hooks/dict.ts'
import { openWordCollectPicker } from '@/core/hooks/useWordCollectPicker.ts'
import WordTypingCore from './WordTypingCore.vue'
import WordIdentifyPanel from './WordIdentifyPanel.vue'
import WordMetaPanel from './WordMetaPanel.vue'
import { useOnKeyboardEventListener } from '@/core/hooks/event.ts'
import { _nextTick, throttle } from '@/core'
import { usePracticeTypeWordController } from '@/core/composables/practice-words/usePracticeTypeWordController.ts'

const { t: $t } = useI18n()

interface IProps {
  word: Word
  question?: Question | null
  /** 当前 Cursor 解析出的真实练习类型。 */
  practiceType: WordPracticeType
  /** 当前练习阶段标识，用于重置“显示单词”计错状态。 */
  phaseKey: string
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
})

const emit = defineEmits<{
  complete: []
  wrong: [source?: 'identifyTyping']
  know: []
  mastered: []
  skip: []
  toggleSimple: []
  quickMark: []
}>()

const settingStore = useSettingStore()
const store = useBaseStore()

// ============ 音频 ============
const playWordAudio = usePlayWordAudio()

const volumeIconRef: any = $ref()
let isTypingWord = $ref(true)

const typingCoreRef = $ref<InstanceType<typeof WordTypingCore>>()
const wordMetaPanelRef = $ref<InstanceType<typeof WordMetaPanel>>()

const typeWordController = usePracticeTypeWordController({
  getWord: () => props.word,
  getPracticeType: () => props.practiceType,
  getPhaseKey: () => props.phaseKey,
  getIsWordMasked: () => effective.value.isWordMasked,
  getAutoPlayFirstSentence: () => settingStore.autoPlayFirstSentence,
  onWrong: source => emit('wrong', source),
  playWordAudio: (word, manual, onEnd) =>
    playWordAudio(word, manual, onEnd, () => {
      volumeIconRef?.animate(true)
    }),
  playFirstSentence: () => wordMetaPanelRef?.playSentence(0, { highlight: true }),
})
let { showFullWord, showWordResult } = $(typeWordController)

const localReveal = computed(() => ({
  showFullWord,
  showWordResult,
}))
const effective = useInjectedDisplayPolicy(localReveal)

function playWord(trigger: WordPlayTrigger) {
  if (trigger === WordPlayTrigger.Manual || settingStore.wordSound) typeWordController.playWord(trigger)
}

function onTypingCoreComplete() {
  if (
    [WordPracticeType.FollowWrite, WordPracticeType.Spell].includes(props.practiceType) &&
    settingStore.practiceSentence &&
    props.word.sentences.length
  ) {
    isTypingWord = false
    return wordMetaPanelRef.startPracticeSentence()
  }
  emit('complete')
}

function onTypingCoreWrong() {
  if (props.practiceType === WordPracticeType.Identify) {
    emit('wrong', 'identifyTyping')
    return
  }
  emit('wrong')
}

function onSentencePracticeComplete() {
  isTypingWord = true
  emit('complete')
}

// ============ 单词操作 ============
function checkIsWrong() {
  if (effective.value.isWordMasked) {
    if (!showWordResult && !typingCoreRef?.isWordRight()) {
      emit('wrong')
    }
  }
}

function onVolumeIconClick() {
  checkIsWrong()
  playWord(WordPlayTrigger.Manual)
}

function play() {
  volumeIconRef?.play()
}

function showWord() {
  typeWordController.showWord()
}

function hideWord() {
  typeWordController.hideWord()
}

const wordWrapRef = useTemplateRef('word-wrap')
function onMouseEnter() {
  if (props.practiceType === WordPracticeType.Identify) return
  //解决：默写情况下，单词显示为下划线，而下划线的宽度比字母的宽度更宽，导致hover上去，单词立马显示，导致整个div的宽度变窄，这样又会立马触发mouseleave
  let rect = wordWrapRef.value.getBoundingClientRect()
  wordWrapRef.value.style.minWidth = rect.width + 'px'
  _nextTick(showWord)
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

// ============ 自测/WordTest 事件处理 ============
let showNotice = false

function onIdentifyKnow() {
  if (!showWordResult) {
    showWordResult = true
    onAnswerCorrect()
    if (!showNotice) {
      Toast.info($t('know_word_tip'), { duration: 5000 })
      showNotice = true
    }
  }
}

function onAnswerWrong() {
  typingCoreRef?.setWordTestResult?.(false, props.word.word)
  emit('wrong')
  playWord(WordPlayTrigger.Typo)
}

function onAnswerCorrect() {
  typingCoreRef?.setWordTestResult?.(true, props.word.word)
  emit('know')
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
  let text = ''
  let show = false
  if (props.practiceType === WordPracticeType.Identify) {
    if (showWordResult) {
      text = typingCoreRef?.isWordRight() ? '按空格键继续' : '请拼写单词'
      show = true
    }
  } else if (props.practiceType === WordPracticeType.Listen) {
    if (showWordResult) {
      text = '按空格键继续'
      show = true
    }
  } else if (props.practiceType === WordPracticeType.Dictation) {
    text = showWordResult
      ? typingCoreRef?.isWordRight()
        ? '按空格键继续'
        : $t('press_delete_reinput')
      : '按空格键完成默写'
    show = true
  } else {
    text = '输入完成后按空格键继续'
    show = true
  }
  return { show, text }
})

// ============ 重置：单词切换时 reset identify / note 状态 ============

watch([() => props.word, () => props.phaseKey], onResetWord)

// keyup 时隐藏单词
useOnKeyboardEventListener(
  () => {},
  () => {
    hideWord()
  }
)

function onResetWord() {
  isTypingWord = true
  typeWordController.reset()
  editingNote = false
  noteInputValue = ''
  if (wordWrapRef.value) wordWrapRef.value.style.minWidth = 'unset'
}

// ============ 收藏 / 简词 ============

const { isWordCollect, toggleWordCollect, isWordSimple, toggleWordSimple } = useWordOptions()
const collectAnchorRef = ref<HTMLElement | null>(null)

function openCollectPicker(e: MouseEvent) {
  e?.stopPropagation?.()
  openWordCollectPicker(props.word, e.currentTarget as HTMLElement, {
    excludeDictId: store.sdict.id ? String(store.sdict.id) : undefined,
  })
}

const isCollect = $computed(() => isWordCollect(props.word))
const isSimple = $computed(() => isWordSimple(props.word))

function collect() {
  toggleWordCollect(props.word)
}

useEvents([
  [EventKey.resetWord, onResetWord],
  //当默写时，执行 show 会标记为错误，并更新卡片
  [ShortcutKey.ShowWord, throttle(showWord, 300)],
  [ShortcutKey.ToggleCollect, collect],
  [ShortcutKey.CollectToDict, () => openCollectPicker({ currentTarget: collectAnchorRef.value } as any)],
  [ShortcutKey.PlayWordPronunciation, play],
])
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
      <Tooltip :title="`快捷键(${settingStore.shortcutKeyMap[ShortcutKey.ShowWord]})显示单词信息`">
        <div
          id="word-wrap"
          ref="word-wrap"
          class="word my-1"
          :style="{ fontSize: settingStore.fontSize.wordForeignFontSize + 'px' }"
          @mouseenter="onMouseEnter"
          @mouseleave="hideWord"
        >
          <WordTypingCore
            ref="typingCoreRef"
            :word="word"
            :active="isTypingWord && !editingNote"
            :practiceType="practiceType"
            :isWordMasked="effective.isWordMasked"
            v-model:showWordResult="showWordResult"
            :showFullWord="showFullWord"
            :wordFontSize="settingStore.fontSize.wordForeignFontSize"
            @play="playWord"
            @complete="onTypingCoreComplete"
            @wrong="onTypingCoreWrong"
          />
        </div>
      </Tooltip>

      <!-- 操作按钮行 -->
      <div class="mt-1 flex gap-4">
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
          @click="collect"
          :title="
            (!isCollect ? $t('collect') : $t('uncollect')) +
            `(${settingStore.shortcutKeyMap[ShortcutKey.ToggleCollect]})`
          "
        >
          <IconFluentStar20Regular v-if="!isCollect" />
          <IconFluentStar20Filled v-else />
        </BaseIcon>
        <span ref="collectAnchorRef" class="inline-flex">
          <BaseIcon
            class="word-collect-anchor"
            @click="openCollectPicker"
            :title="`${$t('collect_to_dict')}(${settingStore.shortcutKeyMap[ShortcutKey.CollectToDict]})`"
          >
            <IconFluentStarAdd16Regular />
          </BaseIcon>
        </span>
        <BaseIcon @click="emit('skip')" :title="`${$t('skip_word')}(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`">
          <IconFluentArrowBounce20Regular class="transform-rotate-180" />
        </BaseIcon>
      </div>

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
          :anim="false"
          :shadow="false"
          :message="notice.text"
          :showClose="store.sdict.statistics.length > 2"
          @close="settingStore.showUsageTips = false"
        />
      </div>

      <!-- 自测 UI -->
      <WordIdentifyPanel
        v-if="!showWordResult && !showFullWord && practiceType === WordPracticeType.Identify"
        :key="word.word"
        :word="word"
        :question="question"
        @know="onIdentifyKnow"
        @unknown="onIdentifyUnknown"
        @mastered="onIdentifyMastered"
        @wrong="onAnswerWrong"
        @correct="onAnswerCorrect"
        @complete="emit('complete')"
        @quickMark="emit('quickMark')"
      />

      <!-- WordMetaPanel: 翻译 + 例句 + 短语 + 词源 等展示 -->
      <!--      不要加key，里面有个只显示一次的变量-->
      <WordMetaPanel
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

@media (max-width: 768px) {
  .typing-word {
    .label {
      @apply w-unset mr-2;
    }
  }
}
</style>
