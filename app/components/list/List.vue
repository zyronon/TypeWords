<script setup lang="ts" generic="T extends Article">
import { BaseIcon, BaseInput, DeleteIcon } from '@/base'
import { cloneDeep, throttle } from '@/core/utils'
import type { Article } from '@/core/types'

interface IProps {
  list: T[]
  selectItem: T
}

const props = defineProps<IProps>()
const emit = defineEmits<{
  selectItem: [index: T]
  delSelectItem: []
  'update:searchKey': [val: string]
  'update:list': [list: T[]]
}>()

let dragItem: T = $ref({ id: '' } as any)
let searchKey = $ref('')
let draggable = $ref(false)

let localList = $computed({
  get() {
    if (searchKey) {
      return props.list.filter((item: Article) => {
        //把搜索内容，分词之后，判断是否有这个词，比单纯遍历包含体验更好
        return searchKey
          .toLowerCase()
          .split(' ')
          .filter(v => v)
          .some(value => {
            return item.title.toLowerCase().includes(value) || item.titleTranslate.toLowerCase().includes(value)
          })
      })
    } else {
      return props.list
    }
  },
  set(newValue) {
    emit('update:list', newValue)
  },
})

function dragstart(item: T) {
  dragItem = item
}

const dragenter = throttle((e, item: T) => {
  // console.log('dragenter', 'item.id', item.id, 'dragItem.id', dragItem.id)
  e.preventDefault()
  // 避免源对象触发自身的dragenter事件
  if (dragItem.id && dragItem.id !== item.id) {
    let rIndex = props.list.findIndex(v => v.id === dragItem.id)
    let rIndex2 = props.list.findIndex(v => v.id === item.id)
    // console.log('dragenter', 'item-Index', rIndex2, 'dragItem.index', rIndex)
    //这里不能直接用localList splice。不知道为什么会导致有筛选的情况下，多动无法变换位置
    let temp = cloneDeep(props.list)
    temp.splice(rIndex, 1)
    temp.splice(rIndex2, 0, cloneDeep(dragItem))
    localList = temp
  }
}, 300)

function dragover(e) {
  // console.log('dragover')
  e.preventDefault()
}

function dragend() {
  // console.log('dragend')
  draggable = false
  dragItem = { id: '' } as T
}

function delItem(item: T) {
  if (item.id === props.selectItem.id) {
    emit('delSelectItem')
  }
  let rIndex = props.list.findIndex(v => v.id === item.id)
  if (rIndex > -1) {
    localList.splice(rIndex, 1)
    //触发set
    localList = localList
  }
}

let el: HTMLDivElement = $ref()

function scrollBottom() {
  el.scrollTo({
    top: el.scrollHeight,
    left: 0,
    behavior: 'smooth',
  })
}

defineExpose({ scrollBottom })
</script>

<template>
  <div class="list-wrapper" ref="el">
    <div class="search">
      <BaseInput clearable v-model="searchKey">
        <template #subfix>
          <IconFluentSearch24Regular class="text-lg text-gray" />
        </template>
      </BaseInput>
    </div>
    <transition-group name="drag" class="space-y-3" tag="div">
      <div
        class="common-list-item"
        :class="[selectItem.id === item.id && 'active', draggable && 'draggable', dragItem.id === item.id && 'active']"
        @click="emit('selectItem', item)"
        v-for="(item, index) in localList"
        :key="item.id"
        :draggable="draggable"
        @dragstart="dragstart(item)"
        @dragenter="dragenter($event, item)"
        @dragover="dragover($event)"
        @dragend="dragend()"
      >
        <div class="left">
          <slot :item="item" :index="index"></slot>
        </div>
        <div class="right">
          <BaseIcon @click.stop="delItem(item)" :title="$t('delete')">
            <DeleteIcon />
          </BaseIcon>
          <div @mousedown="draggable = true" @mouseup="draggable = false">
            <BaseIcon>
              <IconFluentArrowMove20Regular />
            </BaseIcon>
          </div>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped lang="scss">
.drag-move, /* 对移动中的元素应用的过渡 */
.drag-enter-active,
.drag-leave-active {
  transition: all 0.5s ease;
}

.drag-enter-from,
.drag-leave-to {
  opacity: 0;
  transform: translateX(50rem);
}

/* 确保将离开的元素从布局流中删除
  以便能够正确地计算移动的动画。 */
.drag-leave-active {
  position: absolute;
}

.list-wrapper {
  transition: all 0.3s;
  flex: 1;
  overflow: overlay;
  padding-right: 0.3rem;

  .search {
    margin: 0.6rem 0;
  }
}
</style>
