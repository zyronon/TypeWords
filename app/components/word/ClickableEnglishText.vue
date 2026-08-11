<script setup lang="ts">
import { isHighlightToken, splitEnglishText } from '@/core/utils/wordLookup.ts'
import { lookupWord } from '@/core/hooks/useWordLookup.ts'
import { usePlayWordAudio } from '@/core/hooks/sound.ts'
import { computed } from 'vue'

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

const playWordAudio = usePlayWordAudio()

const tokens = computed(() => splitEnglishText(props.text))

function onWordClick(e: MouseEvent, token: string) {
  lookupWord(e, token, playWordAudio)
}

/** 与 SentenceHightLightWord 一致：仅目标词（含变形）应用高亮 / 默写遮罩 */
function tokenClass(token: string,) {
  const classes = ['clickable-word']
  if (props.word && isHighlightToken(token, props.word)) {
    if (props.highLight) classes.push('highlight-word')
    if (props.dictation) classes.push('word-shadow')
  }
  return classes.join(' ')
}
</script>

<template>
  <span class="clickable-english-text">
    <template v-for="(token, index) in tokens" :key="index">
      <span v-if="token.isWord" :class="tokenClass(token.text)" @click="onWordClick($event, token.text)">{{
        token.text
      }}</span>
      <span v-else>{{ token.text }}</span>
    </template>
  </span>
</template>

<style scoped lang="scss">
.clickable-word {
  cursor: pointer;
  border-radius: 0.15rem;
  transition: background-color 0.15s ease;

  &:hover {
    @apply bg-green/70! color-black;
  }
}

</style>
