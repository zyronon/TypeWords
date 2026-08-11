<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Radio, RadioGroup } from '@/base'
import { useBaseStore } from '@/core/stores/base.ts'

const store = useBaseStore()

const isVisible = ref(false)
const scrollContainer = ref<HTMLElement | null>(null)
const itemRefs = ref<(HTMLElement | null)[]>([])

// 计算每个组的词数
const getGroupWordCount = (groupIndex: number) => {
  const totalLength = store.sdict.length
  const perDay = store.sdict.perDayStudyNumber
  const totalGroups = store.groupLength

  // 如果是最后一组且不能被整除，则显示余数
  if (groupIndex === totalGroups && totalLength % perDay !== 0) {
    return totalLength % perDay
  }
  return perDay
}

const handleMouseEnter = () => {
  isVisible.value = true
}

const handleMouseLeave = () => {
  isVisible.value = false
}

// 当弹框显示时，自动滚动到选中的item
watch(isVisible, async newVal => {
  if (newVal) {
    // 等待DOM更新和过渡动画开始
    await nextTick()
    // 再等待一小段时间确保元素已渲染
    const currentIndex = store.currentGroup - 1 // currentGroup是1-based，数组是0-based
    const targetItem = itemRefs.value[currentIndex]
    const container = scrollContainer.value

    if (targetItem && container) {
      // 计算目标item相对于容器的位置
      const itemTop = targetItem.offsetTop
      const itemHeight = targetItem.offsetHeight
      const containerHeight = container.clientHeight

      // 滚动到目标item，使其居中显示
      container.scrollTo({
        top: itemTop - containerHeight / 2 + itemHeight / 2,
      })
    }
  }
})

const setItemRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    itemRefs.value[index] = el
  }
}

const emit = defineEmits<{
  click: [value: number]
}>()
</script>

<template>
  <div class="relative z-999" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <div
      class="pt-2 left-1/2 -transform-translate-x-1/2 absolute z-999 top-full transition-all duration-300"
      :class="{
        'opacity-0 scale-95 pointer-events-none': !isVisible,
        'opacity-100 scale-100 pointer-events-auto': isVisible,
      }"
    >
      <RadioGroup :model-value="store.currentGroup">
        <div class="card-white">
          <div ref="scrollContainer" class="max-h-70 overflow-y-auto space-y-2">
            <div
              :ref="el => setItemRef(el as HTMLElement, value - 1)"
              class="break-keep flex bg-primary px-3 py-1 rounded-md hover:bg-card-active anim border border-solid border-item"
              :class="{
                'bg-card-active!': value === store.currentGroup,
              }"
              @click="emit('click', value)"
              v-for="value in store.groupLength"
              :key="value"
            >
              <Radio :value="value" :label="`第${value}组`" />
              <span class="text-sm ml-2">{{ getGroupWordCount(value) }}词</span>
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
    <div class="target">第{{ store.currentGroup }}组</div>
  </div>
</template>

<style scoped lang="scss">
.target {
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: underline dashed gray;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.3rem;
  &:hover {
    text-decoration: underline dashed transparent;
    background: var(--color-icon-hightlight);
  }
}
</style>
