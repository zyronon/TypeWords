<template>
  <label class="checkbox" :class="{ 'is-disabled': disabled }" @click.stop>
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="change"
    />
    <span class="checkbox-box">
      <span class="checkbox-inner"></span>
    </span>
    <span class="checkbox-label"><slot/></span>
  </label>
</template>

<script setup lang="ts">
defineProps({
  modelValue: Boolean,
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'click', 'onChange'])

function change($event) {
  emit('update:modelValue', $event.target.checked)
  emit('onChange', $event.target.checked)
}
</script>

<style lang="scss" scoped>
.checkbox {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;

  input {
    display: none;
  }

  .checkbox-box {
    position: relative;
    width: 16px;
    height: 16px;
    border: 1px solid #dcdfe6;
    border-radius: 2px;
    background-color: #fff;
    margin-right: 8px;
    transition: all 0.3s;

    .checkbox-inner {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 10px;
      height: 10px;
      background-color: #409eff;
      opacity: 0;
      transition: opacity 0.3s;
      border-radius: 1px;
    }
  }

  input:checked + .checkbox-box .checkbox-inner {
    opacity: 1;
  }

  &:hover .checkbox-box {
    border-color: #409eff;
  }

  .checkbox-label {
    font-size: 14px;
    color: #606266;
  }

  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;

    .checkbox-box {
      border-color: #e4e7ed;
      background-color: #f5f7fa;
    }
  }
}
</style>
