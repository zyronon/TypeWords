<script setup lang="ts">
import type { Word } from '@/core/types'
import { BackIcon, BaseButton, Checkbox, Toast } from '@/base'
import { reactive, ref, watch } from 'vue'
import Header from '@/components/Header.vue'

type PaintMode = 'know' | 'unknown' | 'mastered'

const props = defineProps<{
  words: Word[]
}>()

export type WordMarkPickResult = {
  know: Word[]
  unknown: Word[]
  mastered: Word[]
}

const emit = defineEmits<{
  complete: [payload: WordMarkPickResult]
  back: []
}>()

const paintMode = ref<PaintMode>('know')
const marks = reactive<Record<number, PaintMode>>({})
const chooseAllIndexes = ref<number[]>([])
const chooseAllMode = ref<PaintMode | null>(null)

const modeLabels: Record<PaintMode, string> = {
  know: '我认识',
  unknown: '不认识',
  mastered: '已掌握',
}

/** 与当前顶部模式同色则取消标记，否则设为当前模式。 */
function onWordClick(index: number) {
  if (index < 0 || index >= props.words.length) return
  if (marks[index] === paintMode.value) {
    delete marks[index]
    return
  }
  marks[index] = paintMode.value
}

function rowClass(index: number) {
  const m = marks[index]
  if (!m) return 'mark-none'
  return {
    know: 'mark-know',
    unknown: 'mark-unknown',
    mastered: 'mark-mastered',
  }[m]
}

function buildUnknownList(): Word[] {
  const usedKnow = props.words.some((_, i) => marks[i] === 'know')
  const usedMastered = props.words.some((_, i) => marks[i] === 'mastered')
  const usedUnknown = props.words.some((_, i) => marks[i] === 'unknown')

  const branchSimple = !usedUnknown && !(usedKnow && usedMastered)

  return props.words.filter((_, i) => {
    const m = marks[i]
    if (branchSimple) return m == null
    return m == null || m === 'unknown'
  })
}

function buildThreeLists(): WordMarkPickResult {
  return {
    know: props.words.filter((_, i) => marks[i] === 'know'),
    unknown: buildUnknownList(),
    mastered: props.words.filter((_, i) => marks[i] === 'mastered'),
  }
}

function onComplete() {
  emit('complete', buildThreeLists())
}

function resetChooseAll() {
  chooseAllIndexes.value = []
  chooseAllMode.value = null
}

function chooseAll() {
  if (chooseAllMode.value) {
    const selectedMode = chooseAllMode.value
    chooseAllIndexes.value.forEach(index => {
      if (marks[index] === selectedMode) delete marks[index]
    })
    resetChooseAll()
    return
  }

  const selectedIndexes: number[] = []
  props.words.forEach((_, index) => {
    if (marks[index] != null) return
    marks[index] = paintMode.value
    selectedIndexes.push(index)
  })
  if (!selectedIndexes.length) {
    Toast.info('所有单词均已标记')
    return
  }
  chooseAllIndexes.value = selectedIndexes
  chooseAllMode.value = paintMode.value
}

watch(paintMode, resetChooseAll)
</script>

<template>
  <div class="word-mark-pick-list text-xl flex flex-col gap-3 w-full pt-10">
    <Header title="批量标记" @click="emit('back')"></Header>
    <div>
      操作说明：先选择分类，再点击单词进行标记。再次点击相同分类可取消，切换分类后点击可直接改标。
      <div class="font-bold">未标记和标为“不认识”的单词将进入后续练习。</div>
    </div>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div>当前标记:</div>
        <button
          v-for="mode in ['know', 'unknown', 'mastered'] as const"
          :key="mode"
          type="button"
          class="mode-btn"
          :class="{ active: paintMode === mode, [mode]: true }"
          @click="paintMode = mode"
        >
          {{ modeLabels[mode] }}
        </button>
      </div>
      <BaseButton type="info" @click="chooseAll">{{ chooseAllMode ? '取消全选' : '全选' }}</BaseButton>
    </div>
    <div class="text-sm color-[var(--color-font-3)]">
      省时技巧：先标记数量较少的一类，再切换到多数类别点击“全选”，即可补齐未标记单词；再次点击可撤销本次全选，已有标记不会被覆盖。
    </div>

    <div class="word-grid" role="list" aria-label="单词列表">
      <div
        v-for="(item, index) in words"
        :key="index"
        role="listitem"
        class="word-chip"
        :class="rowClass(index)"
        @click="onWordClick(index)"
      >
        <span class="word-text">{{ item.word }}</span>
      </div>
    </div>

    <div class="center pt-1">
      <BaseButton type="primary" size="large" @click="onComplete">完成标记</BaseButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.word-mark-pick-list {
  max-height: calc(100vh - 12rem);
}

.mode-btn {
  padding: 0.35rem 0.85rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border, #37415155);
  background: var(--color-bg-soft, transparent);
  cursor: pointer;
  color: var(--color-main-text);
  @apply text-xl;
  &.active {
    font-weight: 600;
    border-color: var(--el-color-primary, #646cff);
  }
  &.know.active {
    background: rgba(34, 197, 94, 0.14);
    border-color: rgba(34, 197, 94, 0.35);
    color: #15803d;
  }
  &.unknown.active {
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(239, 68, 68, 0.35);
    color: #b91c1c;
  }
  &.mastered.active {
    background: rgba(59, 130, 246, 0.14);
    border-color: rgba(59, 130, 246, 0.35);
    color: #1d4ed8;
  }
}

.word-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  overflow: auto;
  align-content: flex-start;
  padding: 0.125rem;
  flex: 1;
  -webkit-overflow-scrolling: touch;
}

.word-chip {
  display: flex;
  align-items: flex-start;
  gap: 0.2rem;
  flex: 0 1 auto;
  max-width: 100%;
  padding: 0.3rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border, #37415133);
  cursor: pointer;
  user-select: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  line-height: 1.35;

  .word-text {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
}

.word-chip.mark-know {
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.35);
  .word-text {
    color: #15803d;
  }
}
.word-chip.mark-unknown {
  background: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.35);
  .word-text {
    color: #b91c1c;
  }
}
.word-chip.mark-mastered {
  background: rgba(59, 130, 246, 0.14);
  border-color: rgba(59, 130, 246, 0.35);
  .word-text {
    color: #1d4ed8;
  }
}
.word-chip.mark-none {
  background: var(--color-bg-soft, rgba(255, 255, 255, 0.04));
  &:hover {
    background: rgba(128, 128, 128, 0.1);
    border-color: rgba(128, 128, 128, 0.25);
  }
}
</style>
