<script setup lang="ts">
import BaseIcon from '../BaseIcon.vue'
import { useAttrs } from 'vue'
import { useRouter } from 'vue-router'

const attrs = useAttrs()
const router = useRouter()

function onClick() {
  if (!attrs.onClick) {
    router.back()
  }
}
</script>

<template>
  <BaseIcon :title="$t('back')" @click="onClick">
    <IconFluentChevronLeft28Filled />
  </BaseIcon>
</template>

<style scoped lang="scss"></style>
