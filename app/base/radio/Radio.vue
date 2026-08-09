<template>
  <label
      :class="['radio', sizeClass, { 'is-disabled': isDisabled, 'is-checked': isChecked }]"
      @click.prevent="onClick"
  >
    <input
        type="radio"
        class="hidden"
        :value="value"
        :disabled="isDisabled"
    />
    <span class="radio__inner"></span>
    <span class="text-sm">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
import {inject, computed} from 'vue'

const props = defineProps({
  value: [String, Number, Boolean],
  label: [String, Number, Boolean],
  disabled: {type: Boolean, default: false}
})

// 注入父组状态
const radioGroupValue = inject<any>('radioGroupValue', null)
const radioGroupSize = inject('radioGroupSize', 'default')
const radioGroupDisabled = inject<boolean>('radioGroupDisabled', false)
const updateRadioGroupValue = inject<Function>('updateRadioGroupValue', null)

const sizeClass = computed(() => `radio--${radioGroupSize}`)

// 是否禁用
const isDisabled = computed(() => props.disabled || radioGroupDisabled)

// 是否选中
const isChecked = computed(() => radioGroupValue?.value === props.value)

// 选中时通知父组件
function onClick() {
  if (isDisabled.value) return
  updateRadioGroupValue?.(props.value)
}
</script>

<style scoped>
.radio {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;

  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .radio__inner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 6px;
    position: relative;
    box-sizing: border-box;
    background: white;
    border: 1px solid gainsboro;

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 5px;
      height: 5px;
      background-color: #409eff;
      border-radius: 50%;
      transform: translate(-50%, -50%) scale(0);
      transition: transform 0.2s ease-in-out;
    }
  }
 

  &.is-checked {
    .radio__inner {
      background-color: #409eff;
    }

    .radio__label {
      color: #409eff;
    }

    .radio__inner::after {
      background-color: white;
      transform: translate(-50%, -50%) scale(1);
    }
  }
}

.radio--small {
  .radio__inner {
    width: 14px;
    height: 14px;
  }
}

.radio--large {
  .radio__inner {
    width: 20px;
    height: 20px;
  }
}

</style>
