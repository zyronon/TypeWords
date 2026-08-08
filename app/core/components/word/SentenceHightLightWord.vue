<script setup lang="ts">
import { computed } from 'vue'
import { buildHighlightedHtml } from '../../utils/wordLookup.ts'

interface IProps {
  text: string
  dictation: boolean
  highLight?: boolean
  word: string
}

const props = withDefaults(defineProps<IProps>(), {
  text: '',
  dictation: false,
  highLight: true,
  word: '',
})

const highlightedText = computed(() =>
  buildHighlightedHtml(props.text, props.word, {
    highLight: props.highLight,
    dictation: props.dictation,
  })
)
</script>

<template>
  <span v-html="highlightedText"></span>
</template>

<style scoped lang="scss">
:deep(.highlight-word) {
  color: var(--color-select-bg);
}
</style>
