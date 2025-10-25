<script setup lang="ts">
import { resourceWrap, useNav } from "@/utils";
import BasePage from "@/components/BasePage.vue";
import { DictResource } from "@/types/types.ts";
import { useRuntimeStore } from "@/stores/runtime.ts";
import BaseIcon from "@/components/BaseIcon.vue";
import Empty from "@/components/Empty.vue";
import BaseButton from "@/components/BaseButton.vue";
import DictList from "@/components/list/DictList.vue";
import BackIcon from "@/components/BackIcon.vue";
import { useRouter } from "vue-router";
import { computed } from "vue";
import { getDefaultDict } from "@/types/func.ts";
import { useFetch } from "@vueuse/core";
import { DICT_LIST } from "@/config/env.ts";
import BaseInput from "@/components/base/BaseInput.vue";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const {nav} = useNav()
const runtimeStore = useRuntimeStore()
const router = useRouter()

function selectDict(e) {
  console.log(e.dict)
  getDictDetail(e.dict)
}

async function getDictDetail(val: DictResource) {
  runtimeStore.editDict = getDefaultDict(val)
  nav('book-detail', {from: 'list'})
}

let showSearchInput = $ref(false)
let searchKey = $ref('')
const {data: bookList, isFetching} = useFetch(resourceWrap(DICT_LIST.ARTICLE.ALL)).json()

const searchList = computed<any[]>(() => {
  if (searchKey) {
    let s = searchKey.toLowerCase()
    return bookList.value.filter((item) => {
      return item.id.toLowerCase().includes(s)
          || item.name.toLowerCase().includes(s)
          || item.category.toLowerCase().includes(s)
          || item.tags.join('').replace('所有', '').toLowerCase().includes(s)
          || item?.url?.toLowerCase?.().includes?.(s)
    })
  }
  return []
})

</script>

<template>
  <BasePage>
    <div class="card min-h-50" v-loading="isFetching">
      <div class="flex items-center relative gap-2">
        <BackIcon class="z-2" @Click='router.back'/>
        <div class="flex flex-1 gap-4" v-if="showSearchInput">
          <BaseInput prefix-icon :placeholder="t('SearchBookPlaceholder')" v-model="searchKey" class="flex-1" autofocus clearable/>
          <BaseButton @click="showSearchInput = false, searchKey = ''">{{ t('Cancel') }}</BaseButton>
        </div>
        <div class="py-1 flex flex-1 justify-end" v-else>
          <span class="page-title absolute w-full center">{{ t('BookList') }}</span>
          <BaseIcon @click="showSearchInput = true"
                    class="z-1">
            <IconFluentSearch24Regular/>
          </BaseIcon>
        </div>
      </div>
      <div class="mt-4" v-if="searchKey">
        <DictList
            v-if="searchList.length "
            @selectDict="selectDict"
            :list="searchList"
            :quantifier="t('ArticleQuantifier')"
            :select-id="'-1'"/>
        <Empty v-else :text="t('NoRelatedBooks')"/>
      </div>
      <div class="w-full mt-2" v-else>
        <DictList
            v-if="bookList?.length "
            @selectDict="selectDict"
            :list="bookList"
            :quantifier="t('ArticleQuantifier')"
            :select-id="'-1'"/>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
</style>
