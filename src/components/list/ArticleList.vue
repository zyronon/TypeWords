<script setup lang="ts">

import { Article } from "@/types/types.ts";
import BaseList from "@/components/list/BaseList.vue";
import BaseInput from "@/components/base/BaseInput.vue";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage();

const props = withDefaults(defineProps<{
  list: Article[],
  showTranslate?: boolean
}>(), {
  list: [],
  showTranslate: true,
})

const emit = defineEmits<{
  click: [val: { item: Article, index: number }],
  title: [val: { item: Article, index: number }],
}>()

let searchKey = $ref('')
let localList = $computed(() => {
  if (searchKey) {
    //把搜索内容，分词之后，判断是否有这个词，比单纯遍历包含体验更好
    let t = searchKey.toLowerCase()
    let strings = t.split(' ').filter(v => v);
    let res = props.list.filter((item: Article) => {
      return strings.some(value => {
        return item.title.toLowerCase().includes(value) || item.titleTranslate.toLowerCase().includes(value)
      })
    })
    try {
      let d = Number(t)
      //如果是纯数字，把那一条加进去
      if (!isNaN(d)) {
        if (d - 1 < props.list.length) {
          res.push(props.list[d - 1])
        }
      }
    } catch (err) {
    }
    return res.sort((a: Article, b: Article) => {
      //使完整包含的条目更靠前
      const aMatch = a.title.toLowerCase().includes(t);
      const bMatch = b.title.toLowerCase().includes(t);

      if (aMatch && !bMatch) return -1; // a 靠前
      if (!aMatch && bMatch) return 1;  // b 靠前
      return 0; // 都匹配或都不匹配，保持原顺序
    })
  } else {
    return props.list
  }
})

const listRef: any = $ref(null as any)

function scrollToBottom() {
  listRef?.scrollToBottom()
}

function scrollToItem(index: number) {
  listRef?.scrollToItem(index)
}

defineExpose({scrollToBottom, scrollToItem})

</script>

<template>
  <div class="list">
    <div class="search">
      <BaseInput
          clearable
          v-model="searchKey"
          :placeholder="t('SearchArticles')"
      >
        <template #subfix>
          <IconFluentSearch24Regular class="text-lg text-gray"/>
        </template>
      </BaseInput>
    </div>
    <BaseList
        ref="listRef"
        @click="(e:any) => emit('click',e)"
        :list="localList"
        v-bind="$attrs">
      <template v-slot:prefix="{ item, index }">
        <slot name="prefix" :item="item" :index="index"></slot>
      </template>
      <template v-slot="{ item, index }">
        <div class="item-title">
          <div class="name"> {{ `${searchKey ? '' : (index + 1) + '. '}${item.title}` }}</div>
        </div>
        <div class="item-sub-title" v-if="item.titleTranslate && showTranslate">
          <div class="item-translate"> {{ `   ${t('DisplayLanguage') === 'fr' ? item.titleTranslateFr || item.titleTranslate : item.titleTranslate}` }}</div>
        </div>
      </template>
      <template v-slot:suffix="{ item, index }">
        <slot name="suffix" :item="item" :index="index"></slot>
      </template>
    </BaseList>
  </div>
</template>

<style scoped lang="scss">
.list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  overflow: hidden;

  .search {
    box-sizing: border-box;
    width: 100%;
    padding-right: var(--space);
  }

  .translate {
    font-size: 1rem;
  }
}
</style>
