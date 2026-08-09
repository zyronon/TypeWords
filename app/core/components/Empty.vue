<script setup lang="ts">
import { BaseButton } from '@/base'

defineProps<{
  text?: string
  showAdd?: boolean
}>()

defineEmits<{
  add: []
}>()

</script>

<template>
  <div class="empty">
    <NuxtImg src="/imgs/empty.svg" alt="" />
    <span>{{ text ?? $t('empty_placeholder') }}</span>
    <BaseButton v-if="showAdd" @click="$emit('add')">{{ $t('add') }}</BaseButton>
  </div>
</template>

<style scoped lang="scss">
.empty {
  width: 100%;
  height: 100%;
  min-height: 18rem;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  font-size: .9rem;
  gap: 1.3rem;

  span {
    font-family: var(--font-family);
  }

  img {
    margin-top: -3rem;
    width: 9rem;
  }
}
</style>
