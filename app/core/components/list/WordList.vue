<script setup lang="ts">
import BaseList from './BaseList.vue'
import type { Word } from '../../types'
import WordItem from '../word/WordItem.vue'

interface Props {
  list: Word[]
  excludeWords: string[]
  excludeDictId?: string
  showTranslate?: boolean
  showWord?: boolean
}

withDefaults(defineProps<Props>(), {
  list: [],
  excludeWords: [],
  showTranslate: true,
  showWord: true,
})

const emit = defineEmits<{
  click: [val: { item: Word; index: number }]
}>()

const listRef: any = $ref(null as any)

function scrollToBottom() {
  listRef?.scrollToBottom()
}

function scrollToItem(index: number) {
  listRef?.scrollToItem(index)
}

defineExpose({ scrollToBottom, scrollToItem })
</script>

<template>
  <BaseList ref="listRef" @click="(e: any) => emit('click', e)" :list="list" v-bind="$attrs">
    <template v-slot="{ item, index, active }">
      <WordItem
        :show-translate="showTranslate"
        :disabled="excludeWords.includes(item.word)"
        :show-word="showWord"
        :item="item"
        :index="index"
        :active="active"
        :exclude-dict-id="excludeDictId"
      />
    </template>
  </BaseList>
</template>
