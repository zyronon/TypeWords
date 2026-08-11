<script setup lang="ts">
import { BasePage } from '@/base'
import About from '@/components/About.vue'
import { APP_NAME, Origin } from '@/core/config/env.ts'

let route = useRoute()
let title = APP_NAME + ' 反馈'
useSeoMeta({
  title: title,
  description: title,
  ogTitle: title,
  ogDescription: title,
  ogUrl: Origin + route.fullPath,
  twitterTitle: title,
  twitterDescription: title,
})
</script>

<template>
  <BasePage>
    <div class="center">
      <div class="card-white w-2/3 center-col pb-20">
        <About />
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss"></style>
