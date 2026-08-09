<script setup lang="ts">
import Tooltip from './Tooltip.vue'
import type { ButtonProps } from './types.ts'

withDefaults(defineProps<ButtonProps>(), {
  type: 'primary',
  size: 'normal',
})

defineEmits(['click'])
</script>

<template>
  <Tooltip :disabled="!keyboard" :title="`${keyboard}`">
    <div
      class="base-button"
      v-bind="$attrs"
      @click="e => !disabled && !loading && $emit('click', e)"
      :class="[active && 'active', size, type, (disabled || loading) && 'disabled']"
    >
      <span :style="{ opacity: loading ? 0 : 1 }"><slot></slot></span>
      <IconEosIconsLoading v-if="loading" class="loading" width="18" :color="type === 'info' ? '#000000' : '#ffffff'" />
    </div>
  </Tooltip>
</template>

<style>
:root {
  --btn-primary: rgb(75, 85, 99);
  --btn-primary-disabled: #90969e;
  --btn-primary-hover: rgb(105, 121, 143);
  --btn-info: white;
  --btn-info-hover: #eaeaea;
  --btn-orange: #facc15;
  --btn-orange-hover: #bfac61;
}

html.dark {
  --btn-info: #1b1b1b;
  --btn-info-hover: #3a3a3a;
}
</style>

<style scoped lang="scss">
.base-button {
  position: relative;
  cursor: pointer;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  outline: none;
  text-align: center;
  transition: all 0.3s;
  user-select: none;
  vertical-align: middle;
  white-space: nowrap;
  border-radius: 0.3rem;
  padding: 0 0.9rem;
  font-size: 0.9rem;
  height: 2rem;
  color: white;

  & + .base-button {
    margin-left: 1rem;
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    user-select: none;
    pointer-events: none;
    color: rgba(#fff, 0.4);
  }

  .loading {
    position: absolute;
  }

  &.small {
    border-radius: 0.3rem;
    padding: 0 0.6rem;
    height: 1.6rem;
    font-size: 0.8rem;
  }

  &.large {
    padding: 0 1.3rem;
    height: 2.4rem;
    font-size: 0.9rem;
    border-radius: 0.5rem;
  }

  & > span {
    line-height: 1;
    transform: translateY(-5%);

    :deep(a) {
      color: white;
    }
  }

  &.primary {
    background: var(--btn-primary);

    &.disabled {
      opacity: 1;
      background: var(--btn-primary-disabled);
    }

    &:hover:not(.disabled) {
      background: var(--btn-primary-hover);
    }
  }

  &.info {
    background: var(--btn-info);
    border: 1px solid var(--color-main-text);
    color: var(--color-main-text);

    &:hover:not(.disabled) {
      background: var(--btn-info-hover);
    }
  }

  &.text {
    border: 1px solid var(--color-main-text);
    color: var(--color-main-text);

    &:hover:not(.disabled) {
      background: var(--btn-info);
    }
  }

  &.orange {
    background: var(--btn-orange);
    color: black;

    &:hover:not(.disabled) {
      background: var(--btn-orange-hover);
      color: rgba(0, 0, 0, 0.6);
    }
  }

  &.active {
    opacity: 0.4;
  }
}
</style>
