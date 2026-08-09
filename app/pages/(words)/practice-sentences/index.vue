<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BaseButton, BasePage, Toast } from '@/base'
import Book from '@/core/components/Book.vue'
import Empty from '@/core/components/Empty.vue'
import { useBaseStore } from '@/core/stores/base.ts'
import type { DictResource } from '@/core/types/types.ts'

const router = useRouter()
const store = useBaseStore()

const currentDict = computed(() => store.sdict)
const bookList = computed(() => store.word.bookList.filter(item => item.id))

function startPracticeSentences(dict: DictResource) {
  if (!dict.id) {
    Toast.warning('请先选择一本词典')
    return
  }
  router.push(`/practice-sentences/${dict.id}`)
}
</script>

<template>
  <BasePage>
    <div class="practice-sentences-entry">
      <div class="hero-card">
        <div class="hero-icon">
          <IconFluentTextGrammarWand20Regular />
        </div>
        <div class="hero-content">
          <div class="hero-title">例句练习</div>
          <div class="hero-desc">选择一本词书，把词书中的例句当作单句文章来练习。</div>
        </div>
      </div>

      <div v-if="currentDict.id" class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">当前词书</div>
            <div class="section-subtitle">从当前学习词书开始例句练习</div>
          </div>
        </div>
        <div class="current-dict-card">
          <Book :is-add="false" quantifier="词" :item="currentDict" @click="startPracticeSentences(currentDict)" />
          <BaseButton size="large" @click="startPracticeSentences(currentDict)">
            <div class="center gap-2">
              <span>开始例句练习</span>
              <IconFluentArrowCircleRight20Regular />
            </div>
          </BaseButton>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">我的词书</div>
            <div class="section-subtitle">选择词书进入对应的例句练习</div>
          </div>
        </div>

        <div v-if="bookList.length" class="book-grid">
          <Book
            v-for="item in bookList"
            :key="item.id"
            :is-add="false"
            quantifier="词"
            :item="item"
            @click="startPracticeSentences(item)"
          />
        </div>
        <div v-else class="empty-wrap">
          <Empty />
          <div
            class="select-dict-control"
            role="button"
            tabindex="0"
            @click="router.push('/dict-list')"
            @keydown.enter.prevent="router.push('/dict-list')"
            @keydown.space.prevent="router.push('/dict-list')"
          >
            选择词书
          </div>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.practice-sentences-entry {
  @apply flex flex-col;
}

.hero-card,
.section-card {
  @apply card;
}

.hero-card {
  @apply flex items-center gap-4;
}

.hero-icon {
  @apply h-14 w-14 shrink-0 center rounded-2xl bg-[var(--color-select-bg)] color-reverse-white text-3xl;
}

.hero-content {
  @apply min-w-0;
}

.hero-title {
  @apply text-3xl font-bold color-main;
}

.hero-desc,
.section-subtitle {
  @apply mt-1 text-sm;
  color: var(--color-font-1);
}

.section-card {
  @apply flex flex-col gap-4;
}

.section-head {
  @apply flex items-center justify-between gap-4;
}

.section-title {
  @apply text-xl font-bold color-main;
}

.book-count {
  @apply min-h-9 min-w-9 center rounded-lg bg-[var(--bg-card-secend)] px-3 text-sm color-main;
}

.current-dict-card {
  @apply flex flex-col gap-4 md:flex-row md:items-center;
}

.start-control,
.select-dict-control {
  @apply min-h-11 w-fit center gap-2 rounded-lg bg-[var(--color-select-bg)] px-4 color-reverse-white cp transition-opacity duration-200 hover:opacity-90;
}

.book-grid {
  @apply flex flex-wrap gap-4;
}

.empty-wrap {
  @apply min-h-60 center flex-col gap-4;
}

@media (max-width: 768px) {
  .hero-card {
    @apply items-start;
  }

  .hero-title {
    @apply text-2xl;
  }
}
</style>
