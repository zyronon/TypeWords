<script setup lang="ts">
import { resourceWrap, useNav } from '@/core/utils'
import { BaseButton, BaseIcon, BasePage, BackIcon } from '@/base'
import type { DictResource } from '@/core/types/types.ts'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import Empty from '@/components/Empty.vue'
import DictList from '@/components/list/DictList.vue'
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { getDefaultDict } from '@/core/types/func.ts'
import { useFetch } from '@vueuse/core'
import { DICT_LIST } from '@/core/config/env.ts'
import { BaseInput } from '@/base'

const { nav } = useNav()
const runtimeStore = useRuntimeStore()
const router = useRouter()

function selectDict(e) {
  console.log(e.dict)
  getDictDetail(e.dict)
}

async function getDictDetail(val: DictResource) {
  runtimeStore.editDict = getDefaultDict(val)
  nav('/book/' + val.id, { from: 'list' })
}

let showSearchInput = $ref(false)
let searchKey = $ref('')
const { data: bookList, isFetching } = useFetch<DictResource[]>(resourceWrap(DICT_LIST.ARTICLE.ALL)).json()

const list = $computed(() => {
  return bookList.value?.filter(item => !item.hidden)
})

const searchList = computed<any[]>(() => {
  if (searchKey) {
    let s = searchKey.toLowerCase()
    return list.filter(item => {
      return (
        item.enName.toLowerCase().includes(s) ||
        item.name.toLowerCase().includes(s) ||
        item.category.toLowerCase().includes(s) ||
        item.tags.join('').replace('所有', '').toLowerCase().includes(s) ||
        item?.url?.toLowerCase?.().includes?.(s)
      )
    })
  }
  return []
})
</script>

<template>
  <BasePage>
    <div class="card min-h-50" v-loading="isFetching">
      <div class="flex items-center relative gap-2">
        <BackIcon class="z-2" @Click="router.back" />
        <div class="flex flex-1 gap-4" v-if="showSearchInput">
          <BaseInput
            prefix-icon
            placeholder="请输入书籍名称/缩写/类别"
            v-model="searchKey"
            class="flex-1"
            autofocus
            clearable
          />
          <BaseButton @click="((showSearchInput = false), (searchKey = ''))">{{ $t('cancel') }}</BaseButton>
        </div>
        <div class="py-1 flex flex-1 justify-end" v-else>
          <span class="page-title absolute w-full center">{{ $t('book_list') }}</span>
          <BaseIcon @click="showSearchInput = true" class="z-1">
            <IconFluentSearch24Regular />
          </BaseIcon>
        </div>
      </div>
      <div class="mt-4" v-if="searchKey">
        <DictList
          v-if="searchList.length"
          @selectDict="selectDict"
          :list="searchList"
          quantifier="篇"
          :select-id="'-1'"
        />
        <Empty v-else text="没有相关书籍" />
      </div>
      <div class="w-full mt-2" v-else>
        <DictList v-if="list?.length" @selectDict="selectDict" :list="list" quantifier="篇" :select-id="'-1'" />
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss"></style>
