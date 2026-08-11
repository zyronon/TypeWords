<script setup lang="ts">
defineProps<{
  title: string
  desc: string
}>()
</script>

<template>
  <div
    class="card flex items-center gap-3 px-5 py-4 rounded-xl cp
           bg-gradient-to-r from-gray-100 to-purple-50
           dark:from-violet-950/40 dark:to-purple-950/25
           border border-violet-200/50 dark:border-violet-800/30
           transition-all duration-200 hover:opacity-90 hover:-translate-y-px"
  >
    <!-- 图标 -->
    <div class="w-10 h-10 flex-shrink-0 center rounded-lg bg-violet-200/60 dark:bg-violet-800/40">
      <IconFluentArrowUpload20Regular class="text-xl text-violet-600 dark:text-violet-300" />
    </div>

    <!-- 文字 -->
    <div class="flex-1 min-w-0">
      <div class="text-violet-800 dark:text-violet-100 font-700 text-base leading-tight">{{ title }}</div>
      <div class="text-violet-600/75 dark:text-violet-300/70 text mt-1 truncate">{{ desc }}</div>
    </div>

    <!-- 箭头 -->
    <IconFluentChevronRight20Regular class="text-violet-400 dark:text-violet-400/80 text-xl flex-shrink-0" />
  </div>
</template>
