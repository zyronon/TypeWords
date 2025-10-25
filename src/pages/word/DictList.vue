<script setup lang="ts">
import { groupBy, resourceWrap, useNav } from "@/utils";
import BasePage from "@/components/BasePage.vue";
import { DictResource } from "@/types/types.ts";
import { useRuntimeStore } from "@/stores/runtime.ts";
import BaseIcon from "@/components/BaseIcon.vue";
import Empty from "@/components/Empty.vue";
import BaseButton from "@/components/BaseButton.vue";
import DictList from "@/components/list/DictList.vue";
import BackIcon from "@/components/BackIcon.vue";
import DictGroup from "@/components/list/DictGroup.vue";
import { useBaseStore } from "@/stores/base.ts";
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
const store = useBaseStore()
const router = useRouter()

function selectDict(e) {
  console.log(e.dict)
  getDictDetail(e.dict)
}

async function getDictDetail(val: DictResource) {
  runtimeStore.editDict = getDefaultDict(val)
  nav('dict-detail', {from: 'list'})
}


function groupByDictTags(dictList: DictResource[]) {
  return dictList.reduce<Record<string, DictResource[]>>((result, dict) => {
    dict.tags.forEach((tag) => {
      if (result[tag]) {
        result[tag].push(dict)
      } else {
        result[tag] = [dict]
      }
    })
    return result
  }, {})
}

const {data: dict_list, isFetching} = useFetch(resourceWrap(DICT_LIST.WORD.ALL)).json()

const groupedByCategoryAndTag = $computed(() => {
  let data = []
  if (!dict_list.value) return data
  const groupByCategory = groupBy(dict_list.value, 'category')
  for (const [key, value] of Object.entries(groupByCategory)) {
    data.push([key, groupByDictTags(value)])
  }
  [data[2], data[3]] = [data[3], data[2]];
  console.log('data',data)
  return data
})

let showSearchInput = $ref(false)
let searchKey = $ref('')

const searchList = computed<any[]>(() => {
  if (searchKey) {
    let s = searchKey.toLowerCase()
    return dict_list.value.filter((item) => {
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
    <div class="card min-h-200" v-loading="isFetching">
      <div class="flex items-center relative gap-2">
        <BackIcon class="z-2" @click='router.back'/>
        <div class="flex flex-1 gap-4" v-if="showSearchInput">
          <BaseInput clearable :placeholder="t('SearchDictPlaceholder')" v-model="searchKey" class="flex-1" autofocus/>
          <BaseButton @click="showSearchInput = false, searchKey = ''">{{ t('Cancel') }}</BaseButton>
        </div>
        <div class="py-1 flex flex-1 justify-end" v-else>
          <span class="page-title absolute w-full center">{{ t('DictList') }}</span>
          <BaseIcon
              :title="t('Search')"
              @click="showSearchInput = true"
              class="z-1"
              icon="fluent:search-24-regular">
            <IconFluentSearch24Regular/>
          </BaseIcon>
        </div>
      </div>
      <div class="mt-4" v-if="searchKey">
        <DictList
            v-if="searchList.length "
            @selectDict="selectDict"
            :list="searchList"
            :quantifier="t('WordQuantifier')"
            :select-id="'-1'"/>
        <Empty v-else :text="t('NoRelatedDict')"/>
      </div>
      <div class="w-full" v-else>
        <DictGroup
            v-for="item in groupedByCategoryAndTag"
            :select-id="store.currentStudyWordDict.id"
            @selectDict="selectDict"
            :quantifier="t('WordQuantifier')"
            :groupByTag="item[1]"
            :category="item[0]"
        />
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
</style>
