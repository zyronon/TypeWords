<script setup lang="ts">
defineProps<{
  mainTitle?: string,
  title?: string,
  desc?: string,
}>()
</script>

<template>
  <div class="flex items-center gap-40" :class="desc ? 'mt-4' : 'my-4'" v-bind="$attrs">
    <span v-if="title">{{ title }}</span>
    <span class="text-xl font-bold" v-if="mainTitle">{{ mainTitle }}</span>
    <div class="flex flex-1 justify-end">
      <slot></slot>
    </div>
  </div>
  <div class="text-sm mb-3 text-gray-500" v-if="desc">{{ desc }}</div>
</template>

<style scoped lang="scss">

</style>
