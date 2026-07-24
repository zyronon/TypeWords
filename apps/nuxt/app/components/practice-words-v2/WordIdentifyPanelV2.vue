<script setup lang="ts">
/**
 * WordIdentifyPanelV2 — 自测 / WordTest UI
 *
 * 从 TypeWordV2 拆出，负责：
 * - 自评三按钮（认识/不认识/已掌握）+ 快捷键绑定
 * - WordTest 四选项选择 + 快捷键绑定
 * - 选择结果展示
 */
import type { Question, Word } from '@typewords/core/types/types.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import { IdentifyMethod, ShortcutKey, WordPracticeType } from '@typewords/core/types/enum.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { useEventsByWatch } from '@typewords/core/utils/eventBus.ts'
import { BaseButton } from '@typewords/base'
import TranslationList from '@typewords/core/components/word/TranslationList.vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

interface IProps {
  word: Word
  question?: Question
  showWordResult: boolean
  /** 当前 Cursor 解析出的真实练习类型。 */
  practiceType: WordPracticeType
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  showWordResult: false,
})

const emit = defineEmits<{
  know: []
  mastered: []
  unknown: []
  wrong: []
}>()

const settingStore = useSettingStore()

let showAllCandidates = $ref(false)
let completeSelect = false
let selectIndex = $ref(-1)

const isSelfAssessment = $computed(() => {
  return (
    props.practiceType === WordPracticeType.Identify &&
    settingStore.identifyMethod === IdentifyMethod.SelfAssessment
  )
})

const isWordTest = $computed(() => {
  return (
    props.practiceType === WordPracticeType.Identify &&
    settingStore.identifyMethod === IdentifyMethod.WordTest
  )
})

function know() {
  if (isSelfAssessment) {
    if (!props.showWordResult) {
      emit('know')
      return
    }
  }
}

function mastered() {
  if (isSelfAssessment) {
    emit('mastered')
    return
  }
}

function unknown() {
  if (isSelfAssessment) {
    if (!props.showWordResult) {
      emit('unknown')
      return
    }
  }
}

function select(e: KeyboardEvent | MouseEvent, index: number) {
  if (completeSelect) return
  if (isWordTest) {
    completeSelect = true
    selectIndex = index
    if (index == props.question?.correctIndex) {
      emit('know')
    } else {
      emit('wrong')
    }
    return
  }
}

function resetIdentifyState() {
  showAllCandidates = false
  completeSelect = false
  selectIndex = -1
}

// 快捷键绑定
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
    [ShortcutKey.ChooseA, (e: KeyboardEvent) => select(e, 0)],
    [ShortcutKey.ChooseB, (e: KeyboardEvent) => select(e, 1)],
    [ShortcutKey.ChooseC, (e: KeyboardEvent) => select(e, 2)],
    [ShortcutKey.ChooseD, (e: KeyboardEvent) => select(e, 3)],
  ],
  () => isWordTest
)

defineExpose({
  showAllCandidates,
  resetIdentifyState,
})
</script>

<template>
  <template v-if="isSelfAssessment && !showWordResult">
    <div class="mt-4 flex gap-2">
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
  </template>

  <div v-if="isWordTest && !showWordResult" class="flex gap-8 flex-col my-8 w-full">
    <div
      v-for="(value, index) in question?.candidates ?? []"
      class="flex gap-2 min-h-20"
      :class="{
        'text-green-600': completeSelect && index === question?.correctIndex,
        'text-red-600': completeSelect && index !== question?.correctIndex && index === selectIndex,
      }"
    >
      <BaseButton
        :keyboard="`${$t('shortcut')}(${settingStore.shortcutKeyMap[[ShortcutKey.ChooseA, ShortcutKey.ChooseB, ShortcutKey.ChooseC, ShortcutKey.ChooseD][index]]})`"
        @click="(e: MouseEvent) => select(e, index)"
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
</template>
