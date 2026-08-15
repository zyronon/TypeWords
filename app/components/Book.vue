<script setup lang="ts">
import type { Dict } from '@/core/types'
import { Checkbox, Progress } from '@/base'
import { withAppBaseURL } from '@/core/utils/base-url'

interface IProps {
  item?: Partial<Dict>
  quantifier?: string
  isAdd: boolean
  showCheckbox?: boolean
  checked?: boolean
  selected?: boolean
  showProgress?: boolean
  isUser?: boolean //是否是用户的词典
}

const props = withDefaults(defineProps<IProps>(), {
  showProgress: true,
  isUser: false,
})

const emit = defineEmits<{
  check: []
  click: []
}>()

const progress = $computed(() => {
  return Number(((props.item?.lastLearnIndex / props.item?.length) * 100).toFixed())
})

const studyProgress = $computed(() => {
  if (!props.showProgress) return
  return props.item?.lastLearnIndex ? props.item?.lastLearnIndex + '/' : ''
})

const coverSrc = $computed(() => {
  return props.item?.cover ? withAppBaseURL(props.item.cover) : ''
})

function handleClick(e: MouseEvent) {
  if (props.showCheckbox) {
    e.stopPropagation()
    emit('check')
  } else {
    emit('click')
  }
}
</script>

<template>
  <div style="width: var(--book-width)" :id="`dict-${item?.id}`" v-if="!isAdd" @click="handleClick">
    <div
      class="book overflow-hidden relative"
      :class="[showCheckbox && 'book-selectable', (selected || checked) && 'book-selected']"
    >
      <img class="absolute top-0 left-0 w-full object-cover" v-if="item?.cover" :src="coverSrc" alt="" />
      <div class="text-base mt-1" v-else>{{ item?.name }}</div>
      <div class="absolute bottom-4 right-3 z-1" v-if="!item?.cover">
        <div>{{ studyProgress }}{{ item?.length }}{{ quantifier }}</div>
      </div>
      <div class="absolute bottom-2 left-3 right-3">
        <Progress
          v-if="item?.lastLearnIndex && showProgress"
          class="mt-1"
          :percentage="progress"
          :show-text="false"
        ></Progress>
      </div>
      <Checkbox
        v-if="showCheckbox"
        :model-value="checked"
        @change="$emit('check')"
        class="absolute left-2 bottom-3 z-3"
      />
      <div class="custom z-1" v-if="item.custom">{{ $t('custom') }}</div>
      <div class="system z-1" v-else-if="item.system">内置</div>
      <!--      <div class="custom bg-red! color-white z-1" v-else-if="item.update">更新中</div>-->
      <!--      <div class="sync bg-red! color-white z-1" v-if="!item.sync && isUser && !showCheckbox">未同步</div>-->
    </div>
    <div class="flex justify-between text-base mt-1" v-if="item?.cover">
      <div class="w-6/10 truncate">{{ item?.name }}</div>
      <div>{{ studyProgress }}{{ item?.length }}{{ quantifier }}</div>
    </div>
  </div>
  <div v-else class="book" id="no-book" @click="handleClick">
    <div class="h-full center text-2xl">
      <IconFluentAdd16Regular />
    </div>
  </div>
</template>

<style scoped lang="scss">
.book-selectable {
  &:hover {
    border-color: var(--color-input-border);
  }
}

.book-selected {
  @apply bg-fifth;
  border-color: var(--color-select-bg) !important;
}

.custom {
  position: absolute;
  top: 4px;
  right: -22px;
  padding: 1px 20px;
  background: #409eff;
  color: white;
  font-size: 11px;
  transform: rotate(45deg);
}

.system {
  position: absolute;
  left: 10px;
  bottom: 18px;
  border-radius: 8px;
  padding: 2px 8px;
  // background: var(--color-link);
  background: #409eff;
  color: white;
  font-size: 11px;
}

.sync {
  @extend .custom;
  bottom: 4px;
  left: -22px;
  top: unset;
  right: unset;
}
</style>
