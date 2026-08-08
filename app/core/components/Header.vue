<script setup lang="ts">
import { BackIcon } from '@/base'
import { useAttrs } from 'vue'

interface IProps {
  title: string
  showBackIcon?: boolean
}

withDefaults(defineProps<IProps>(), {
  title: '',
  showBackIcon: true,
})

const attrs = useAttrs()
</script>

<template>
  <div class="mb-3 font-bold relative min-h-8">
    <BackIcon class="z-2 relative" v-bind="attrs" v-if="showBackIcon" />
    <span class="absolute text-center w-full left-0" @click.stop>{{ title }}</span>
  </div>
</template>

<style scoped lang="scss"></style>
