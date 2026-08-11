<script setup lang="ts">
/**
 * WordIdentifyPanel — 自测 / WordTest UI
 *
 * 从 TypeWord 拆出，负责：
 * - 自评三按钮（认识/不认识/已掌握）+ 快捷键绑定
 * - WordTest 四选项选择 + 快捷键绑定
 * - 选择结果展示
 */
import type { Question, Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { ShortcutKey } from '@/core/types/enum.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { useEvents, useEventsByWatch } from '@/core/utils/eventBus.ts'
import { BaseButton, Switch, ToastComponent, Tooltip } from '@/base'
import TranslationList from '@/components/word/TranslationList.vue'
import { useI18n } from 'vue-i18n'
import { useBaseStore } from '@/core/stores/base.ts'

const { t: $t } = useI18n()

interface IProps {
  word: Word
  question?: Question | null
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
})

const emit = defineEmits<{
  know: []
  mastered: []
  unknown: []
  correct: []
  wrong: []
  quickMark: []
  complete: []
}>()

const store = useBaseStore()
const settingStore = useSettingStore()
let completeSelect = $ref(false)
let selectIndex = $ref(-1)

function know() {
  emit('know')
}

function mastered() {
  emit('mastered')
}

function unknown() {
  emit('unknown')
}

let isCorrect = $computed(() => selectIndex === props.question?.correctIndex)

function select(e: KeyboardEvent | MouseEvent, index: number) {
  if (completeSelect) return
  completeSelect = true
  selectIndex = index
  if (isCorrect) {
    emit('correct')
  } else {
    emit('wrong')
  }
}

useEvents([
  [ShortcutKey.KnowWord, know],
  [ShortcutKey.UnknownWord, unknown],
  [ShortcutKey.MasteredWord, mastered],
])
useEventsByWatch(
  [
    [ShortcutKey.SelfTestingChooseA, (e: KeyboardEvent) => select(e, 0)],
    [ShortcutKey.SelfTestingChooseB, (e: KeyboardEvent) => select(e, 1)],
    [ShortcutKey.SelfTestingChooseC, (e: KeyboardEvent) => select(e, 2)],
    [ShortcutKey.SelfTestingChooseD, (e: KeyboardEvent) => select(e, 3)],
  ],
  () => settingStore.showWordQuestion
)

const text = $computed(() => {
  if (!completeSelect) {
    return '请选择 或 直接拼写'
  } else {
    if (isCorrect) {
      return '按空格键继续'
    } else {
      return '请输入单词'
    }
  }
})
</script>

<template>
  <!-- 提示 Toast -->
  <div class="center mt-3" v-if="settingStore.showUsageTips">
    <ToastComponent
      :duration="0"
      :anim="false"
      :shadow="false"
      :message="text"
      :showClose="store.sdict.statistics.length > 2"
      @close="settingStore.showUsageTips = false"
    />
  </div>

  <div class="mt-4 flex gap-2 relative w-full center">
    <Tooltip>
      <IconFluentQuestionCircle20Regular class="absolute left-0 bottom-0 opacity-50" width="24" />
      <template #reference>
        <div class="p-1">
          <ul class="pl-4 my-0">
            <li>直接拼写：直接输入单词；开始输入后，该词会自动标记为 <span class="font-bold">“不认识”</span></li>
            <li>
              快速标记：{{
                `${$t('shortcut')}(${settingStore.shortcutKeyMap[ShortcutKey.KnowWord]}/${settingStore.shortcutKeyMap[ShortcutKey.UnknownWord]}/${settingStore.shortcutKeyMap[ShortcutKey.MasteredWord]})`
              }}
              分别标记为“我认识 / 不认识 / 已掌握
            </li>
            <li>
              选择答案：按{{
                `${$t('shortcut')}(${settingStore.shortcutKeyMap[ShortcutKey.SelfTestingChooseA]}/${settingStore.shortcutKeyMap[ShortcutKey.SelfTestingChooseB]}/${settingStore.shortcutKeyMap[ShortcutKey.SelfTestingChooseC]}/${settingStore.shortcutKeyMap[ShortcutKey.SelfTestingChooseD]})`
              }}，或点击 A～D
            </li>
            <li>批量标记：点击右侧按钮，可一次标记多个单词</li>
          </ul>
          <div class="opacity-50 flex items-center">
            <span>提示：快捷键可在设置中修改</span>
          </div>
        </div>
      </template>
    </Tooltip>

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

    <div class="flex gap-2 center absolute! right-0">
      <Tooltip :title="`${settingStore.showWordQuestion ? '关闭' : '开启'}答案选项`">
        <Switch type="info" v-model="settingStore.showWordQuestion" />
      </Tooltip>
      <BaseButton type="text" keyboard="批量标记" class="" @click="emit('quickMark')">
        <IconFluentMultiselectRtl20Regular />
      </BaseButton>
    </div>
  </div>

  <template v-if="settingStore.showWordQuestion">
    <div class="line-white my-3"></div>

    <div class="flex flex-col gap-1.5 w-full">
      <div
        v-for="(value, index) in question?.candidates"
        class="flex gap-2 question cp"
        @click="(e: MouseEvent) => select(e, index)"
        :class="{
          'text-green-600 question-correct': completeSelect && index === question?.correctIndex,
          'text-red-600 question-wrong': completeSelect && index !== question?.correctIndex && index === selectIndex,
        }"
      >
        <BaseButton
          type="text"
          class="mt-1.5"
          :keyboard="`${$t('shortcut')}(${settingStore.shortcutKeyMap[[ShortcutKey.SelfTestingChooseA, ShortcutKey.SelfTestingChooseB, ShortcutKey.SelfTestingChooseC, ShortcutKey.SelfTestingChooseD][index]]})`"
        >
          {{ ['A', 'B', 'C', 'D'][index] }}
        </BaseButton>
        <div class="ml-2">
          <TranslationList :word="value.word" :showFull="completeSelect" />
          <div class="text-2xl" v-if="completeSelect">
            {{ value.word.word }}
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
<style scoped lang="scss">
.question {
  @apply rounded-lg px-3 pb-1 -mx-3;
  background: transparent;
  transition:
    background-color 0.3s ease,
    box-shadow 0.3s ease;
}
.question-correct {
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-link) 25%, transparent);
}
.question-wrong {
  background: color-mix(in srgb, red 10%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, red 25%, transparent);
}
</style>
