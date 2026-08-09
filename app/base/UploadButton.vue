<script setup lang="ts">
import type { ButtonProps } from './types.ts'
import BaseButton from './BaseButton.vue'
import { computed, useAttrs } from 'vue'

/** 声明 props：编辑器有提示；与 attrs 合并后再传给子组件（仅 v-bind="$attrs" 拿不到已声明的 props） */
defineOptions({ inheritAttrs: false })

const props = defineProps<ButtonProps & { accept: string }>()
const attrs = useAttrs()

const buttonBind = computed(() => ({
  ...attrs,
  ...props,
}))

type Emits = {
  change: [e: Element]
}
const emit = defineEmits<Emits>()

const onChange = e => {
  emit('change', e)
  // 这里触发了之后，需要重置一下Input，不然再次点击选同一个文件，不会触发事件
  if (e && e.target) {
    e.target.value = ''
  }
}
</script>
<template>
  <div class="base-button inline-block relative">
    <BaseButton v-bind="buttonBind" size="large"><slot></slot></BaseButton>
    <input
      v-if="!buttonBind.disabled"
      type="file"
      class="absolute left-0 top-0 w-full h-full opacity-0"
      :accept="accept"
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.base-button + .base-button {
  margin-left: 1rem;
}
</style>
