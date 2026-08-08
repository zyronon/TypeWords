<template>
  <div class="flex gap-5" v-bind="$attrs">
    <slot/>
  </div>
</template>

<script setup lang="ts">
import {provide, ref, watch} from 'vue'

const props = defineProps({
  modelValue: [String, Number, Boolean],
  disabled: {type: Boolean, default: false},
  size: {type: String, default: 'default'} // small / default / large
})

const emit = defineEmits(['update:modelValue'])

const groupValue = ref(props.modelValue)

// 提供给子组件
provide('radioGroupSize', props.size)
provide('radioGroupValue', groupValue)
provide('radioGroupDisabled', props.disabled)
provide('updateRadioGroupValue', (val: string | number | boolean) => {
  if (props.disabled) return
  // groupValue.value = val
  emit('update:modelValue', val)
})

// 外部 v-model 更新同步
watch(() => props.modelValue, (val) => {
  groupValue.value = val
})

</script>
