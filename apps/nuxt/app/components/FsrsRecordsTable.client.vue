<script setup lang="ts">
import { getCurrentInstance, type App } from 'vue'
import VxeUITable from 'vxe-table'
import 'vxe-table/lib/style.css'
import dayjs from 'dayjs'
import { State } from 'ts-fsrs'

export interface FsrsRow {
  word: string
  last_review?: string | Date | null
  due?: string | Date | null
  state: number
  stability?: number
  difficulty?: number
  elapsed_days?: number
  scheduled_days?: number
  learning_steps?: number
  reps?: number
  lapses?: number
  [key: string]: unknown
}

defineProps<{
  rows: FsrsRow[]
}>()

// 标记挂在 app 上：模块级变量在 HMR/重载时会丢，但 app 不变，避免重复 use() 导致重复注册
const FSRS_VXE_INSTALLED = '__fsrsVxeTableInstalled' as const

const instance = getCurrentInstance()
if (instance) {
  const app = instance.appContext.app as App & { [FSRS_VXE_INSTALLED]?: boolean }
  if (!app[FSRS_VXE_INSTALLED]) {
    app.use(VxeUITable)
    app[FSRS_VXE_INSTALLED] = true
  }
}

function formatDate(v: string | Date | null | undefined) {
  return v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
}

function getStateName(state: number | undefined): string {
  const stateMap: Record<number, string> = {
    0: '新词',
    1: '学习中',
    2: '复习中',
    3: '重新学',
  }
  return stateMap[state ?? -1] ?? '未知'
}
function getScheduledDays(state: number | undefined): string {
  return state === 0 ? '立刻' : state + '天后'
}
</script>

<template>
  <div class="flex-1 overflow-hidden h-full">
    <vxe-table
      round
      border
      show-overflow
      show-header-overflow
      show-footer-overflow
      height="auto"
      :data="rows"
      :row-config="{ keyField: 'word', isHover: true }"
      :virtual-y-config="{ enabled: true, gt: 100 }"
      :sort-config="{
        defaultSort: {
          field: 'due',
          order: 'asc',
        },
      }"
    >
      <vxe-column type="seq" width="60" title="序号" fixed="left" />
      <vxe-column field="word" title="单词" min-width="120" fixed="left" sortable />
      <vxe-column field="last_review" title="最近复习时间" min-width="160" sortable>
        <template #default="{ row }">
          {{ formatDate(row.last_review as string | Date | null | undefined) }}
        </template>
      </vxe-column>
      <vxe-column field="due" title="下次复习时间" min-width="160" sortable>
        <template #default="{ row }">
          {{ formatDate(row.due as string | Date | null | undefined) }}
        </template>
      </vxe-column>
      <vxe-column field="scheduled_days" title="复习间隔" min-width="90" sortable>
        <template #default="{ row }">
          {{ getScheduledDays(row.scheduled_days) }}
        </template>
      </vxe-column>
      <vxe-column field="state" title="状态" min-width="100" sortable>
        <template #default="{ row }">
          {{ getStateName(row.state) }}
        </template>
      </vxe-column>
      <vxe-column field="reps" title="复习次数" min-width="90" sortable />
      <vxe-column field="lapses" title="遗忘次数" min-width="90" sortable />
      <!--            <vxe-column field="elapsed_days" title="经过天数" min-width="90" sortable/>-->
      <!--            <vxe-column field="learning_steps" title="学习步骤" min-width="90" />-->
      <vxe-column field="stability" title="记忆稳定性" min-width="100" sortable />
      <vxe-column field="difficulty" title="难度" min-width="80" sortable />
    </vxe-table>
  </div>
</template>

<style scoped lang="scss"></style>
