<script setup lang="ts">
import { BasePage } from '@/base'
import { APP_NAME, Origin } from '@/core/config/env.ts'

let title = APP_NAME + ' 新概念英语'
let route = useRoute()
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
    <div class="">
      <div class="card-white flex gap-4" v-for="i in 4">
        <NuxtImg src="imgs/covers/nce-1.png" />
        <div>
          <div class="title">新概念英语第一册</div>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss"></style>
