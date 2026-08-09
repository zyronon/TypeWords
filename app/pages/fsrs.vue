<script setup lang="ts">
import { useBaseStore } from '@/core/stores/base.ts'
import { BaseButton } from '@/base'
import dayjs from 'dayjs'
import isToday from 'dayjs/plugin/isToday' // ES 2015
import utc from 'dayjs/plugin/utc'
import Header from '@/core/components/Header.vue'

dayjs.extend(isToday)
dayjs.extend(utc)

const baseStore = useBaseStore()
let type = $ref('today')

// 将 fsrsData 转换为数组
const fsrsList = computed(() => {
  return Object.entries(baseStore.fsrsData)
    .filter(([word, card]) => {
      return type === 'today' ? dayjs.utc(card.last_review).local().isToday() : true
    })
    .map(([word, card]: [string, any]) => ({
      word,
      ...card,
    }))
  // .sort((a, b) => dayjs.utc(b.due).valueOf() - dayjs.utc(a.due).valueOf())
})
</script>

<template>
  <div class="p-4 box-border h-screen flex flex-col">
    <Header title="学习记录" />
    <div class="flex justify-end items-center mb-4">
      <span class="mr-4">共 {{ fsrsList.length }} 条记录</span>
      <BaseButton :type="type === 'today' ? 'primary' : 'info'" @click="type = 'today'">今日学习</BaseButton>
      <BaseButton :type="type === 'all' ? 'primary' : 'info'" @click="type = 'all'">所有记录</BaseButton>
    </div>

    <FsrsRecordsTable :rows="fsrsList" />
  </div>
</template>

<style scoped lang="scss"></style>
