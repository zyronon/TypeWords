<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { VolumeIcon } from '@typewords/base'
import { useOnKeyboardEventListener } from '@typewords/core/hooks/event.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import type { ArticleWord } from '@typewords/core/types/types.ts'
import type { SentencePracticeItem, SentencePracticeMode } from '~/composables/practice-sentences/types.ts'
import { useSentenceTypingFlow } from '~/composables/practice-sentences/useSentenceTypingFlow.ts'

interface IProps {
  item: SentencePracticeItem | null
  mode: SentencePracticeMode
  active?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  item: null,
  mode: 'followWrite',
  active: true,
})

const emit = defineEmits<{
  complete: []
  wrong: []
  play: []
  change: []
}>()

const modeRef = computed(() => props.mode)

const flow = useSentenceTypingFlow({
  getItem: () => props.item,
  mode: modeRef,
  onComplete: () => emit('complete'),
  onWrong: () => emit('wrong'),
  onChange: () => emit('change'),
})
const { state, words, compareText } = flow

const showEnglishTokens = computed(() => props.mode === 'followWrite' || state.showResult)
const showTranslate = computed(() => {
  if (!props.item?.source.translate) return false
  if (props.mode === 'listen') return state.showResult
  return true
})

function handleTyping(e: KeyboardEvent) {
  if (!props.active) return
  flow.onTyping(e)
}

watch(
  () => props.active,
  active => {
    emitter.off(EventKey.onTyping, handleTyping)
    if (active) emitter.on(EventKey.onTyping, handleTyping)
  },
  { immediate: true }
)

onUnmounted(() => {
  emitter.off(EventKey.onTyping, handleTyping)
})

function onKeyDown(e: KeyboardEvent) {
  if (!props.active) return
  if (e.key === 'Backspace') {
    flow.del()
    e.preventDefault()
  }
}

useOnKeyboardEventListener(onKeyDown, () => {})

function play() {
  emit('play')
}

function getPlaceholder(word: string) {
  return word
    .split('')
    .map(char => (char === ' ' ? ' ' : '_'))
    .join('')
}

function getTokenSegments(word: ArticleWord) {
  const input = word.input ?? ''
  const segments: Array<{ type: 'right' | 'wrong' | 'rest'; text: string }> = []

  function push(type: 'right' | 'wrong' | 'rest', text: string) {
    if (!text) return
    const last = segments[segments.length - 1]
    if (last?.type === type) {
      last.text += text
    } else {
      segments.push({ type, text })
    }
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    const target = word.word[i] ?? ''
    push(compareText(char, target) ? 'right' : 'wrong', char)
  }

  if (input.length < word.word.length) {
    push('rest', word.word.slice(input.length))
  }

  return segments
}
</script>

<template>
  <div class="sentence-practice" :class="{ inactive: !active }">
    <template v-if="item">
      <div class="sentence-action">
        <VolumeIcon :simple="false" title="发音" :cb="play" />
      </div>

      <div class="sentence-line" :class="{ hidden: !showEnglishTokens }">
        <template v-for="(word, wordIdx) in words" :key="`${item.id}-${wordIdx}`">
          <span
            class="sentence-token"
            :class="wordIdx === state.wordIndex && !state.isSpace && !state.isEnd && 'is-current'"
          >
            <span
              v-for="(segment, segmentIdx) in getTokenSegments(word)"
              :key="`${wordIdx}-${segmentIdx}`"
              :class="`segment-${segment.type}`"
            >
              {{ segment.type === 'rest' && !showEnglishTokens ? getPlaceholder(segment.text) : segment.text }}
            </span>
          </span>
          <span v-if="word.nextSpace" class="sentence-space">&nbsp;</span>
        </template>
      </div>

      <div v-if="showTranslate" class="sentence-translate">
        {{ item.source.translate }}
      </div>
    </template>
    <div v-else class="empty-state">暂无可练习的句子</div>
  </div>
</template>

<style scoped lang="scss">
.sentence-practice {
  @apply relative w-full rounded-lg border border-item-solid bg-[var(--bg-card-primary)] px-4 py-5 md:px-5 md:py-6;
  color: var(--color-font-2);
  transition:
    opacity 0.2s ease,
    border-color 0.2s ease;

  &.inactive {
    opacity: 0.72;
  }
}

.sentence-action {
  @apply absolute right-3 top-3;
}

.sentence-line {
  @apply w-full pr-10 leading-relaxed text-2xl md:text-3xl;
  font-family: var(--en-article-family);
  letter-spacing: 0;
  word-break: break-word;
  overflow-wrap: anywhere;

  &.hidden {
    @apply text-xl md:text-2xl;
  }
}

.sentence-token {
  @apply inline rounded-md px-0.5 transition-colors duration-200;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;

  &.is-current {
    box-shadow: inset 0 -2px 0 var(--color-select-bg);
  }
}

.sentence-space {
  @apply inline-block w-2 md:w-3;
}

.sentence-placeholder {
  @apply color-gray-400;
}

.segment-right {
  color: var(--color-select-bg);
}

.segment-wrong {
  @apply color-red;
}

.segment-rest {
  color: var(--color-font-2);
}

.sentence-translate,
.empty-state {
  color: var(--color-font-1);
}

.sentence-translate {
  @apply mt-4 text-base md:text-lg leading-relaxed;
  font-family: var(--zh-article-family);
}

.empty-state {
  @apply min-h-30 center text-base;
}

@media (max-width: 768px) {
  .sentence-practice {
    @apply px-3 py-4;
  }
}
</style>
