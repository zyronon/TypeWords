<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { VolumeIcon } from '@/base'
import type { Question, Word } from '@/core/types/types.ts'
import { ShortcutKey } from '@/core/types/enum.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { useEvents } from '@/core/utils/eventBus.ts'
import { cancelWordPracticeAudio, usePlayWordAudio } from '@/core/hooks/sound.ts'
import TranslationList from './TranslationList.vue'

const props = defineProps<{ word: Word; question: Question | null }>()
const emit = defineEmits<{ answer: [correct: boolean]; complete: [] }>()
const settings = useSettingStore()
const playAudio = usePlayWordAudio()
const bumpActivity = inject<() => void>('bumpPracticeTimerActivity', () => {})
const submitted = ref(false)
const selectedIndex = ref(-1)
let advancing = false
const correct = computed(() => submitted.value && selectedIndex.value === props.question?.correctIndex)
const phonetic = computed(() =>
  settings.soundType === 'us' && props.word.phonetic1
    ? { label: '美', value: props.word.phonetic1 }
    : { label: props.word.phonetic0 ? '英' : '美', value: props.word.phonetic0 || props.word.phonetic1 }
)

function select(index: number) {
  if (submitted.value || !props.question || !props.word.word) return
  if (index >= props.question.candidates.length) return
  bumpActivity()
  selectedIndex.value = index
  submitted.value = true
  emit('answer', index === props.question.correctIndex)
}

function next(event?: Event) {
  event?.preventDefault()
  if (!submitted.value || advancing) return
  bumpActivity()
  advancing = true
  emit('complete')
}

function autoPlay() {
  // 刷新后尚无用户交互时，浏览器可能禁止自动播放；手动发音始终可用。
  if (settings.wordSound && props.word.word && navigator.userActivation?.hasBeenActive)
    playAudio(props.word.word, false)
}

watch(
  () => props.question,
  () => {
    submitted.value = false
    selectedIndex.value = -1
    advancing = false
  }
)
watch(() => props.word.word, autoPlay)
onMounted(autoPlay)
onUnmounted(cancelWordPracticeAudio)
useEvents([
  [ShortcutKey.ChooseA, () => select(0)],
  [ShortcutKey.ChooseB, () => select(1)],
  [ShortcutKey.ChooseC, () => select(2)],
  [ShortcutKey.ChooseD, () => select(3)],
  [ShortcutKey.WordTestingNext, next],
  [ShortcutKey.PlayWordPronunciation, () => playAudio(props.word.word)],
])
</script>

<template>
  <section class="recognition-word" aria-label="认词学习" v-if="word.word">
    <p class="mode-label">认词学习 · 无需拼写</p>
    <div class="word-heading">
      <h1 :style="{ fontSize: settings.fontSize.wordForeignFontSize + 'px' }">{{ word.word }}</h1>
      <VolumeIcon title="播放单词发音" :cb="() => playAudio(word.word)" />
    </div>
    <p class="phonetic" v-if="phonetic.value">{{ phonetic.label }} / {{ phonetic.value }} /</p>
    <p class="question-label">选择这个单词的中文含义</p>
    <div class="choices" v-if="question" role="group" aria-label="中文释义选项">
      <button
        v-for="(option, index) in question.candidates"
        :key="option.word.word"
        type="button"
        class="choice"
        :class="{
          right: submitted && index === question.correctIndex,
          wrong: submitted && index === selectedIndex && !correct,
        }"
        :disabled="submitted"
        @click="select(index)"
      >
        <span class="choice-letter">{{ ['A', 'B', 'C', 'D'][index] }}</span>
        <span class="choice-text"><TranslationList :word="option.word" :showFull="false" /></span>
        <span class="choice-key">{{
          settings.shortcutKeyMap[
            [ShortcutKey.ChooseA, ShortcutKey.ChooseB, ShortcutKey.ChooseC, ShortcutKey.ChooseD][index]
          ]
        }}</span>
      </button>
    </div>
    <div v-if="submitted" class="answer" aria-live="polite">
      <p class="answer-status">{{ correct ? '答对了' : '记住这个含义，稍后会再次巩固' }}</p>
      <TranslationList :word="word" :showFull="true" />
      <button type="button" class="continue-button" @click="next">下一个单词 · 空格</button>
    </div>
    <button v-else type="button" class="unknown-button" @click="select(-1)">不认识，查看答案</button>
    <p class="learning-note">完成本组后计入学习进度，错词会用选择题巩固并安排复习。</p>
  </section>
</template>

<style scoped lang="scss">
.recognition-word {
  width: 100%;
  padding: 1.5rem 0;
  text-align: center;
}
.mode-label,
.phonetic,
.learning-note {
  opacity: 0.7;
  font-size: 0.9rem;
}
.word-heading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}
h1 {
  font-family: inherit;
  margin: 0.5rem 0;
  overflow-wrap: anywhere;
}
.question-label {
  margin: 1.5rem 0 1rem;
  font-size: 1rem;
}
.choices {
  display: grid;
  gap: 0.75rem;
}
.choice {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--color-sub-gray);
  border-radius: 0.7rem;
  background: var(--color-second);
  color: inherit;
  font: inherit;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
}
.choice:hover:not(:disabled),
.choice:focus-visible {
  border-color: var(--color-link);
  outline: 2px solid var(--color-link);
  outline-offset: 2px;
}
.choice:disabled {
  cursor: default;
  opacity: 1;
}
.choice.right {
  border-color: #168552;
  background: color-mix(in srgb, #168552 14%, transparent);
}
.choice.wrong {
  border-color: #d13d3d;
  background: color-mix(in srgb, #d13d3d 12%, transparent);
}
.choice-letter {
  font-weight: 700;
  flex-shrink: 0;
}
.choice-text {
  flex: 1;
}
.choice-key {
  font-size: 0.8rem;
  opacity: 0.55;
}
.answer {
  margin-top: 1rem;
  font-size: 1rem;
}
.answer-status {
  font-weight: 600;
}
.continue-button,
.unknown-button {
  margin-top: 1rem;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
}
.continue-button {
  border: 0;
  background: var(--btn-primary);
  color: white;
}
.unknown-button {
  border: 1px solid var(--color-sub-gray);
  color: inherit;
  background: transparent;
}
.learning-note {
  margin-top: 1.25rem;
  line-height: 1.6;
}
</style>
