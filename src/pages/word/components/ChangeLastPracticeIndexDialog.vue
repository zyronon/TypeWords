<script setup lang="ts">

import BaseTable from "@/components/BaseTable.vue";
import WordItem from "@/components/WordItem.vue";
import {useBaseStore} from "@/stores/base.ts";
import {defineAsyncComponent} from "vue";
import { useRuntimeStore } from "@/stores/runtime.ts";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const Dialog = defineAsyncComponent(() => import('@/components/dialog/Dialog.vue'))

const model = defineModel()
const runtimeStore = useRuntimeStore()

defineEmits<{
  ok: [number]
}>()
</script>

<template>
  <!--  todo 这里显示的时候可以选中并高亮当前index-->
  <!--  todo 这个组件的分布器，需要直接可跳转指定页面，并显示一页有多少个-->
  <Dialog v-model="model" :title="t('ModifyLearningProgress')">
    <div class="px-4 pb-4 h-80vh w-30rem">
      <BaseTable
          class="h-full"
          :list='runtimeStore.editDict.words'
          :loading='false'
          :show-toolbar="false"
      >
        <template v-slot="item">
          <WordItem
              @click="$emit('ok',item.index)"
              :item="item.item" :show-translate="false">
            <template v-slot:prefix>
              {{ item.index }}
            </template>
          </WordItem>
        </template>
      </BaseTable>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">

</style>
