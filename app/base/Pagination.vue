<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BaseInput from './BaseInput.vue'

interface IProps {
  currentPage?: number
  pageSize?: number
  pageSizes?: number[]
  layout?: string
  total: number
  hideOnSinglePage?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  currentPage: 1,
  pageSize: 10,
  pageSizes: () => [10, 20, 30, 40, 50, 100],
  layout: 'prev, pager, next',
  hideOnSinglePage: false,
})

const emit = defineEmits<{
  'update:currentPage': [val: number]
  'update:pageSize': [val: number]
  'size-change': [val: number]
  'current-change': [val: number]
}>()

const internalCurrentPage = ref(props.currentPage)
const jumpTarget = $ref('')
const internalPageSize = ref(props.pageSize)

// 计算总页数
const pageCount = computed(() => {
  return Math.max(1, Math.ceil(props.total / internalPageSize.value))
})

// 可用于显示的页码数量，会根据容器宽度动态计算
const availablePagerCount = ref(5) // 默认值

// 是否显示分页
const shouldShow = computed(() => {
  return props.hideOnSinglePage ? pageCount.value > 1 : true
})

// 处理页码变化
function jumpPage(val: number) {
  if (Number(val) > pageCount.value) val = pageCount.value
  if (Number(val) <= 0) val = 1
  internalCurrentPage.value = val
  emit('update:currentPage', Number(val))
  emit('current-change', Number(val))
}

function jumpToTarget() {
  let d = Number(jumpTarget)
  if (d > pageCount.value) {
    // 这里如果目标值大于页码，那么将目标值作为下标计算，计算出对应的页码再跳转
    // 按目标值-1整除每页数量，定位属于第几页
    let page = Math.floor((d - 1) / internalPageSize.value) + 1
    jumpPage(page)
  } else {
    jumpPage(d)
  }
}

// 处理每页条数变化
function handleSizeChange(val: number) {
  internalPageSize.value = val
  emit('update:pageSize', val)
  emit('size-change', val)

  // 重新计算可用页码数量
  calculateAvailablePagerCount()

  // 重新计算当前页，确保当前页在有效范围内
  const newPageCount = Math.ceil(props.total / val)
  if (internalCurrentPage.value > newPageCount) {
    internalCurrentPage.value = newPageCount
    emit('update:currentPage', newPageCount)
    emit('current-change', newPageCount)
  }
}

// 计算可用宽度并更新页码数量
function calculateAvailablePagerCount() {
  // 在下一个渲染周期执行，确保DOM已更新
  setTimeout(() => {
    const paginationEl = document.querySelector('.pagination') as HTMLElement
    if (!paginationEl) return

    const containerWidth = paginationEl.offsetWidth
    const buttonWidth = 38 // 按钮宽度（包括margin）
    const availableWidth = containerWidth - 120 // 减去其他元素占用的空间（前后按钮等）

    // 计算可以显示多少个页码按钮
    const maxPagers = Math.max(3, Math.floor(availableWidth / buttonWidth) - 2) // 减2是因为第一页和最后一页始终显示
    availablePagerCount.value = maxPagers
  }, 0)
}

// 监听窗口大小变化
onMounted(() => {
  window.addEventListener('resize', calculateAvailablePagerCount)
  // 初始计算
  calculateAvailablePagerCount()
})

// 组件卸载时移除监听器
onUnmounted(() => {
  window.removeEventListener('resize', calculateAvailablePagerCount)
})

// 上一页
function prev() {
  const newPage = internalCurrentPage.value - 1
  if (newPage >= 1) {
    jumpPage(newPage)
  }
}

// 下一页
function next() {
  const newPage = internalCurrentPage.value + 1
  if (newPage <= pageCount.value) {
    jumpPage(newPage)
  }
}
</script>

<template>
  <div class="pagination" v-if="shouldShow">
    <div class="pagination-container">
      <!-- 总数 -->
      <span v-if="layout.includes('total')" class="total text-base"> {{ $t('total') }}{{ total }}{{ $t('total_items') }} </span>
      <!-- 上一页 -->
      <button class="btn-prev" :disabled="internalCurrentPage <= 1" @click="prev">
        <IconFluentChevronLeft20Filled />
      </button>

      <!-- 页码 -->
      <div class="flex items-center">
        <div class="w-12">
          <BaseInput v-model="internalCurrentPage" @enter="jumpPage(internalCurrentPage)" class="text-center" />
        </div>
        <span class="mx-2">/</span>
        <span class="text-base">{{ pageCount }}</span>
      </div>

      <!-- 下一页 -->
      <button class="btn-next" :disabled="internalCurrentPage >= pageCount" @click="next">
        <IconFluentChevronLeft20Filled class="transform-rotate-180" />
      </button>

      <!-- 每页条数选择器 -->
      <div v-if="layout.includes('sizes')" class="sizes">
        <select :value="internalPageSize" @change="handleSizeChange(Number($event.target.value))">
          <option v-for="item in pageSizes" :key="item" :value="item">{{ item }}{{ $t('items_per_page') }}</option>
        </select>
      </div>

      <div class="flex items-center gap-1 ml-2">
        {{ $t('jump_to') }}
        <div class="w-15">
          <BaseInput :placeholder="$t('page_or_index')" v-model="jumpTarget" @enter="jumpToTarget" class="text-center" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pagination {
  white-space: normal;
  color: var(--color-main-text);
  font-weight: normal;
  display: flex;
  justify-content: center;
  width: 100%;

  .pagination-container {
    display: flex;
    align-items: center;
    font-size: 0.875rem;
    max-width: 100%;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .btn-prev,
  .btn-next {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    font-size: 1rem;
    min-width: 1.9375rem;
    height: 1.9375rem;
    border-radius: 0.2rem;
    cursor: pointer;
    color: #606266;
    border: none;
    padding: 0 0.375rem;
    margin: 0.25rem 0.25rem;
    background-color: transparent;
    transition: all 0.3s;

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    &:hover:not(:disabled) {
      background-color: var(--color-third);
      color: var(--color-select-bg);
    }
  }

  .sizes {
    border: 1px solid var(--color-input-border);
    border-radius: 0.25rem;
    padding-right: 0.2rem;
    background-color: var(--color-bg);
    overflow: hidden;

    select {
      height: 1.9375rem;
      padding: 0 0.5rem;
      font-size: 0.875rem;
      border: none;
      background-color: transparent;
      color: var(--color-main-text);

      &:focus {
        outline: none;
        border-color: var(--el-color-primary, #409eff);
      }

      &:disabled {
        background-color: #f5f7fa;
        color: #c0c4cc;
        cursor: not-allowed;
      }
    }
  }

  .total {
    color: var(--color-main-text);
  }
}
</style>
