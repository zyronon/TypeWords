<script setup lang="ts">
import BaseTable from '@/components/BaseTable.vue'
import WordItem from './WordItem.vue'
import { defineAsyncComponent } from 'vue'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import { AppEnv } from '@/core/config/env.ts'

const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

const model = defineModel()
const runtimeStore = useRuntimeStore()

async function requestList({ pageNo, pageSize, searchKey }) {
  let list = runtimeStore.editDict.words
  let total = list.length
  list = list.slice((pageNo - 1) * pageSize, (pageNo - 1) * pageSize + pageSize)
  return { list, total }
}

defineEmits<{
  ok: [number]
}>()
</script>

<template>
  <!--  todo 这里显示的时候可以选中并高亮当前index-->
  <!--  todo 这个组件的分页器，需要直接可跳转指定页面，并显示一页有多少个-->
  <Dialog v-model="model" padding title="修改学习进度">
    <div class="py-4 h-80vh">
      <BaseTable class="h-full" :request="requestList" :show-toolbar="false">
        <template v-slot="item">
          <WordItem
            @click="$emit('ok', item.index - 1)"
            :item="item.item"
            :show-translate="false"
            :index="item.index"
            :show-option="false"
          />
        </template>
      </BaseTable>
    </div>
  </Dialog>
</template>

<style scoped lang="scss"></style>
