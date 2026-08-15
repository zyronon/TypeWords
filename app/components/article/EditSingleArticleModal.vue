<script setup lang="ts">
import type { Article } from '@/core/types'
import { useDisableEventListener } from '@/core/hooks/event'
import EditArticle from './EditArticle.vue'
import { getDefaultArticle } from '@/core/types'
import { defineAsyncComponent } from 'vue'

const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

interface IProps {
  article?: Article
  modelValue: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  article: () => getDefaultArticle(),
  modelValue: false,
})
const emit = defineEmits<{
  save: [val: Article]
  'update:modelValue': [val: boolean]
}>()

useDisableEventListener(() => props.modelValue)
</script>

<template>
  <Dialog :header="false" :model-value="props.modelValue" @close="emit('update:modelValue', false)" :full-screen="true">
    <div class="wrapper">
      <EditArticle :article="article" @save="val => emit('save', val)" />
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
.wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  background: var(--color-primary);
}
</style>
