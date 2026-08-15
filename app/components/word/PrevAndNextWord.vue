<script setup lang="ts">
import type { Word } from '@/core/types/types.ts'
import type { PracticeData } from '@/core/composables/practice-words/practice-word-session.ts'
import { ShortcutKey } from '@/core'
import { Tooltip } from '@/base'
import { useSettingStore } from '@/core/stores/setting.ts'

const props = defineProps<{
  data: PracticeData
  isWordMasked: boolean
}>()

const emit = defineEmits<{
  prev: []
  next: [val: boolean]
  openNotice: []
}>()

const prevWord: Word | null = $computed(() => {
  return props.data.words?.[props.data.index - 1] ?? null
})
const nextWord: Word | null = $computed(() => {
  return props.data.words?.[props.data.index + 1] ?? null
})

const settingStore = useSettingStore()
</script>

<template>
  <!--        前后单词-->
  <div
    class="fixed z-1 top-4 w-full hidden md:block"
    style="left: calc(50vw + var(--aside-width) / 2 - var(--toolbar-width) / 2); width: var(--toolbar-width)"
    v-if="settingStore.showNearWord"
  >
    <Tooltip :title="`上一个(${settingStore.shortcutKeyMap[ShortcutKey.Previous]})`">
      <div class="relative z-2 center gap-2 cp float-left" @click="emit('prev')" v-if="prevWord">
        <IconFluentArrowLeft16Regular class="arrow" width="22" />
        <div class="word">{{ prevWord.word }}</div>
      </div>
    </Tooltip>

    <div class="center gap-1 absolute w-full cp" v-if="settingStore.showConflictNotice2" @click="emit('openNotice')">
      <IconFluentQuestionCircle20Regular />
      <span class="">无法输入？</span>
    </div>

    <Tooltip :title="`下一个(${settingStore.shortcutKeyMap[ShortcutKey.Next]})`">
      <div class="relative center gap-2 cp float-right mr-3" @click="emit('next', false)" v-if="nextWord">
        <div class="word" :class="isWordMasked && 'word-shadow'">
          {{ nextWord.word }}
        </div>
        <IconFluentArrowRight16Regular class="arrow" width="22" />
      </div>
    </Tooltip>
  </div>
</template>

<style scoped lang="scss"></style>
