<template>
  <div class="flex gap-5 w-full h-3">
    <template v-for="i of props.stages">
      <template v-if="i?.children?.length && i.active">
        <div class="flex gap-1" :style="{ width: i.ratio + '%' }">
          <template v-for="j of i.children">
            <Tooltip :title="j.name">
              <Progress
                :style="{ width: j.ratio + '%' }"
                :percentage="j.percentage"
                :stroke-width="8"
                :color="j.active ? '#72c240' : '#69b1ff'"
                :active="j.active"
                :show-text="false"
              />
            </Tooltip>
          </template>
        </div>
      </template>
      <template v-else>
        <Tooltip :title="i.name">
          <Progress
            :style="{ width: i.ratio + '%' }"
            :percentage="i.percentage"
            :stroke-width="8"
            :color="i.active && props.stages.length > 1 ? '#72c240' : '#69b1ff'"
            :active="i.active"
            :show-text="false"
          />
        </Tooltip>
      </template>
    </template>
  </div>
</template>
<script setup lang="ts">
import { Tooltip, Progress } from '@/base'

const props = defineProps<{
  stages: {
    name: string
    active?: boolean
    percentage: number
    ratio: number
    children: {
      active: boolean
      name: string
      percentage: number
      ratio: number
    }[]
  }[]
}>()
</script>
<style scoped lang="scss"></style>
