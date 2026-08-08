<script setup lang="ts">
import { _nextTick, groupBy, isMobile, loadJsLib, resourceWrap, useNav } from '@/core/utils'
import { BackIcon, BaseButton, BaseIcon, BaseInput, BasePage } from '@/base'
import type { DictResource } from '@/core/types/types.ts'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import Empty from '@/core/components/Empty.vue'
import DictList from '@/core/components/list/DictList.vue'
import DictGroup from '@/core/components/list/DictGroup.vue'
import { useBaseStore } from '@/core/stores/base.ts'
import { useRouter } from 'vue-router'
import { computed, watch } from 'vue'
import { getDefaultDict } from '@/core/types/func.ts'
import { useFetch } from '@vueuse/core'
import { DICT_LIST, LIB_JS_URL, TourConfig } from '@/core/config/env.ts'
import { useSettingStore } from '@/core/stores/setting.ts'

const { nav } = useNav()
const runtimeStore = useRuntimeStore()
const settingStore = useSettingStore()
const store = useBaseStore()
const router = useRouter()

function selectDict(e) {
  console.log(e.dict)
  getDictDetail(e.dict)
}

async function getDictDetail(val: DictResource) {
  runtimeStore.editDict = getDefaultDict(val)
  nav('/dict', { from: 'list' })
}

function groupByDictTags(dictList: DictResource[]) {
  return dictList.reduce<Record<string, DictResource[]>>((result, dict) => {
    dict.tags.forEach(tag => {
      if (result[tag]) {
        result[tag].push(dict)
      } else {
        result[tag] = [dict]
      }
    })
    return result
  }, {})
}

const { data: dict_list, isFetching } = useFetch(resourceWrap(DICT_LIST.WORD.ALL)).json()

const groupedByCategoryAndTag = $computed(() => {
  let data = []
  if (!dict_list.value) return data
  const groupByCategory = groupBy(dict_list.value, 'category')
  for (const [key, value] of Object.entries(groupByCategory)) {
    data.push([key, groupByDictTags(value)])
  }
  // ;[data[2], data[3]] = [data[3], data[2]]
  // console.log('data', data)
  return data
})

let showSearchInput = $ref(false)
let searchKey = $ref('')

const searchList = computed<any[]>(() => {
  if (searchKey) {
    let s = searchKey.toLowerCase()
    return dict_list.value.filter(item => {
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

watch(dict_list, val => {
  if (!val.length) return
  let cet4 = val.find(v => v.id === 1)
  if (!cet4) return
  _nextTick(async () => {
    const Shepherd = await loadJsLib('Shepherd', LIB_JS_URL.SHEPHERD)
    const tour = new Shepherd.Tour(TourConfig)
    tour.on('cancel', () => {
      localStorage.setItem('tour-guide', '1')
    })
    tour.addStep({
      id: 'step2',
      text: '选一本自己准备学习的词典',
      attachTo: { element: '#dict-1', on: 'bottom' },
      buttons: [
        {
          text: `下一步（2/${TourConfig.total}）`,
          action() {
            tour.next()
            selectDict({ dict: cet4 })
          },
        },
      ],
    })

    const r = localStorage.getItem('tour-guide')
    if (settingStore.first && !r && !isMobile()) {
      tour.start()
    }
  }, 500)
})
</script>

<template>
  <BasePage>
    <div class="card min-h-200 dict-list-page" v-loading="isFetching">
      <div class="flex items-center relative gap-2 header-section">
        <BackIcon class="z-2" @click="router.back" />
        <div class="flex flex-1 gap-4" v-if="showSearchInput">
          <BaseInput clearable placeholder="请输入词典名称/缩写/类别" v-model="searchKey" class="flex-1" autofocus />
          <BaseButton @click="((showSearchInput = false), (searchKey = ''))">{{ $t('cancel') }}</BaseButton>
        </div>
        <div class="py-1 flex flex-1 justify-end" v-else>
          <span class="page-title absolute w-full center">{{ $t('dict_list') }}</span>
          <BaseIcon :title="$t('search')" @click="showSearchInput = true" class="z-1" icon="fluent:search-24-regular">
            <IconFluentSearch24Regular />
          </BaseIcon>
        </div>
      </div>
      <div class="mt-4" v-if="searchKey">
        <DictList
          v-if="searchList.length"
          @selectDict="selectDict"
          :list="searchList"
          quantifier="词"
          :select-id="'-1'"
        />
        <Empty v-else text="没有相关词典" />
      </div>
      <div class="w-full" v-else>
        <DictGroup
          v-for="item in groupedByCategoryAndTag"
          :select-id="store.sdict.id"
          @selectDict="selectDict"
          quantifier="词"
          :groupByTag="item[1]"
          :category="item[0]"
        />
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">

@media (max-width: 768px) {
  .dict-list-page {
    padding: 0.8rem;
    margin-bottom: 1rem;

    .header-section {
      flex-direction: column;
      gap: 0.5rem;

      .flex.flex-1.gap-4 {
        width: 100%;

        .base-input {
          font-size: 0.9rem;
        }

        .base-button {
          padding: 0.5rem 0.8rem;
          font-size: 0.9rem;
        }
      }

      .py-1.flex.flex-1.justify-end {
        width: 100%;

        .page-title {
          font-size: 1.2rem;
        }

        .base-icon {
          font-size: 1.2rem;
        }
      }
    }

    .mt-4 {
      margin-top: 0.8rem;
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .dict-list-page {
    padding: 0.5rem;

    .header-section {
      .flex.flex-1.gap-4 {
        .base-input {
          font-size: 0.8rem;
        }

        .base-button {
          padding: 0.4rem 0.6rem;
          font-size: 0.8rem;
        }
      }

      .py-1.flex.flex-1.justify-end {
        .page-title {
          font-size: 1rem;
        }

        .base-icon {
          font-size: 1rem;
        }
      }
    }
  }
}
</style>
