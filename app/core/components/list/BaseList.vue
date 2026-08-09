<script setup lang="ts">
import { useSettingStore } from '../../stores/setting.ts'
import { nextTick, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    list?: any[]
    activeIndex?: number
    activeId?: number | string
    isActive?: boolean
    static?: boolean
  }>(),
  {
    list: [],
    activeIndex: -1,
    activeId: '',
    isActive: false,
    static: true,
  }
)

const emit = defineEmits<{
  click: [
    val: {
      item: any
      index: number
    },
  ]
}>()

//虚拟列表长度限制
const limit = 200
const settingStore = useSettingStore()
const listRef: any = $ref()

const localActiveIndex = $computed(() => {
  if (props.activeId) {
    return props.list.findIndex(v => v.id === props.activeId)
  }
  return props.activeIndex
})

function scrollViewToCenter(index: number) {
  if (index === -1) return
  nextTick(() => {
    if (props.list.length > limit) {
      listRef?.scrollToItem(index)
    } else {
      listRef?.children[index]?.scrollIntoView({block: 'center', behavior: 'smooth'})
    }
  })
}

watch(
  () => localActiveIndex,
  (n: any) => {
    if (props.static) return
    if (settingStore.showPanel) {
      scrollViewToCenter(n)
    }
  },
  {immediate: true}
)

watch(
  () => props.isActive,
  (n: boolean) => {
    if (props.static) return
    if (n) {
      setTimeout(() => scrollViewToCenter(localActiveIndex), 300)
    }
  }
)

watch(
  () => props.list,
  () => {
    if (props.static) return
    nextTick(() => {
      if (props.list.length > limit) {
        listRef?.scrollToItem(0)
      } else {
        listRef?.scrollTo(0, 0)
      }
    })
  }
)

function scrollToBottom() {
  nextTick(() => {
    if (props.list.length > limit) {
      listRef.scrollToBottom()
    } else {
      listRef?.scrollTo(0, listRef.scrollHeight)
    }
  })
}

function scrollToItem(index: number) {
  nextTick(() => {
    if (props.list.length > limit) {
      listRef?.scrollToItem(index)
    } else {
      listRef?.children[index]?.scrollIntoView({block: 'center', behavior: 'smooth'})
    }
  })
}

function itemIsActive(item: any, index: number) {
  return props.activeId ? props.activeId == item.id : props.activeIndex === index
}

defineExpose({scrollToBottom, scrollToItem})
</script>

<template>
  <DynamicScroller
    v-if="list.length > limit"
    :items="list"
    ref="listRef"
    :min-item-size="90"
    class="scroller"
  >
    <template v-slot="{ item, index, active }">
      <DynamicScrollerItem
        :item="item"
        :active="active"
        :size-dependencies="[item.id]"
        :data-index="index"
      >
        <div class="list-item-wrapper"
             @click="emit('click', { item, index })">
          <slot :item="item" :index="index+1" :active="itemIsActive(item, index)"></slot>
        </div>
      </DynamicScrollerItem>
    </template>
  </DynamicScroller>
  <div v-else class="scroller" style="overflow: auto" ref="listRef">
    <div class="list-item-wrapper" v-for="(item, index) in props.list" :key="item.title"
         @click="emit('click', { item, index })"
    >
      <slot :item="item" :index="index+1" :active="itemIsActive(item, index)"></slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.scroller {
  flex: 1;
  //padding: 0 var(--space);
  padding-right: var(--space);
}
</style>
