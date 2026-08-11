<script setup lang="ts">
import type {Dict} from '@/core/types';
import Book from "@/components/Book.vue";

defineProps<{
  list?: Partial<Dict>[],
  selectId?: string
  quantifier?: string
}>()

const emit = defineEmits<{
  selectDict: [val: { dict: any, index: number }]
  del: [val: { dict: any, index: number }]
  detail: [],
  add: []
}>()

</script>

<template>
  <div class="flex gap-4 flex-wrap">
    <Book v-for="(dict,index) in list"
          :is-add="false"
          @click="emit('selectDict',{dict,index})"
          :quantifier="quantifier"
          :item="dict"/>
  </div>
</template>

<style scoped lang="scss">
.dict-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}


@media (max-width: 768px) {
  .flex.gap-4.flex-wrap {
    gap: 0.5rem;

    .book {
      width: 5rem;
      height: calc(5rem * 1.4);
      padding: 0.5rem;
      cursor: pointer;
      position: relative;
      z-index: 10;

      .text-base {
        font-size: 0.8rem;
        line-height: 1.2;
        word-break: break-word;
        margin-bottom: 0.2rem;
      }

      .text-sm {
        font-size: 0.7rem;
        line-height: 1.1;
        margin-bottom: 0.3rem;
      }

      .absolute.bottom-4.right-3 {
        bottom: 0.8rem;
        right: 0.3rem;
        font-size: 0.7rem;
        line-height: 1;
      }

      .absolute.bottom-2.left-3.right-3 {
        bottom: 0.2rem;
        left: 0.3rem;
        right: 0.3rem;
      }

      .absolute.left-3.bottom-3 {
        left: 0.3rem;
        bottom: 0.3rem;
      }
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .flex.gap-4.flex-wrap {
    gap: 0.3rem;

    .book {
      width: 4.5rem;
      height: calc(4.5rem * 1.4);
      padding: 0.4rem;

      .text-base {
        font-size: 0.7rem;
        line-height: 1.1;
      }

      .text-sm {
        font-size: 0.6rem;
        line-height: 1;
      }

      .absolute.bottom-4.right-3 {
        font-size: 0.6rem;
      }
    }
  }
}

</style>
