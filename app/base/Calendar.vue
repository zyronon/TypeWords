<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    highlightedDates: string[]
    /** 周模式标题（无 weekHeader 插槽时使用） */
    weekHeaderTitle?: string
  }>(),
  { weekHeaderTitle: '' }
)

const emit = defineEmits<{
  selectDate: [dateKey: string]
}>()

type ViewMode = 'week' | 'month'

const viewMode = ref<ViewMode>('week')

const now = new Date()
const viewYear = ref(now.getFullYear())
const viewMonth = ref(now.getMonth())
const viewWeekAnchor = ref(new Date(now.getFullYear(), now.getMonth(), now.getDate()))

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** ISO 周：周一为一周开始 */
function startOfIsoWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}

const highlightSet = computed(() => new Set(props.highlightedDates))

const todayKey = computed(() => toDateKey(new Date()))

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

type Cell = {
  dateKey: string
  day: number
  inMonth: boolean
  isToday: boolean
  hasHighlight: boolean
}

const weekStart = computed(() => startOfIsoWeek(viewWeekAnchor.value))

const weekEnd = computed(() => {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + 6)
  return d
})

const weekCells = computed((): Cell[] => {
  const out: Cell[] = []
  const tKey = todayKey.value
  const start = weekStart.value
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const dateKey = toDateKey(d)
    out.push({
      dateKey,
      day: d.getDate(),
      inMonth: true,
      isToday: dateKey === tKey,
      hasHighlight: highlightSet.value.has(dateKey),
    })
  }
  return out
})

const cells = computed((): Cell[] => {
  const y = viewYear.value
  const m = viewMonth.value
  const first = new Date(y, m, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(y, m, 1 - offset)
  const out: Cell[] = []
  const tKey = todayKey.value
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const dateKey = toDateKey(d)
    out.push({
      dateKey,
      day: d.getDate(),
      inMonth: d.getMonth() === m,
      isToday: dateKey === tKey,
      hasHighlight: highlightSet.value.has(dateKey),
    })
  }
  return out
})

const monthTitle = computed(() => `${viewYear.value}年${pad2(viewMonth.value + 1)}月`)

const displayCells = computed(() => (viewMode.value === 'week' ? weekCells.value : cells.value))

/** 从月模式回到周模式：始终定位到「今天」所在周 */
function applyAnchorWhenLeavingMonthView() {
  const calNow = new Date()
  viewWeekAnchor.value = new Date(calNow.getFullYear(), calNow.getMonth(), calNow.getDate())
}

function toggleViewMode() {
  if (viewMode.value === 'week') {
    const w = weekStart.value
    viewYear.value = w.getFullYear()
    viewMonth.value = w.getMonth()
    viewMode.value = 'month'
  } else {
    applyAnchorWhenLeavingMonthView()
    viewMode.value = 'week'
  }
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value -= 1
  } else {
    viewMonth.value -= 1
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value += 1
  } else {
    viewMonth.value += 1
  }
}

function onSelectCell(cell: Cell) {
  emit('selectDate', cell.dateKey)
}
</script>

<template>
  <div class="study-calendar">
    <div class="cal-header">
      <BaseButton v-if="viewMode === 'month'" type="info" size="small" @click="prevMonth" aria-label="上月">
        ‹
      </BaseButton>
      <div v-else class="cal-header-lead" aria-hidden="true" />

      <div class="text-lg font-bold">
        <div v-if="viewMode === 'week'" class="">
          {{ weekHeaderTitle }}
        </div>
        <template v-else>{{ monthTitle }}</template>
      </div>

      <div class="cal-header-actions">
        <BaseButton
          type="info"
          size="small"
          class="cal-toggle"
          :title="viewMode === 'week' ? '展开月视图' : '回到周视图'"
          @click="toggleViewMode"
        >
          {{ viewMode === 'week' ? '月' : '周' }}
        </BaseButton>
        <BaseButton v-if="viewMode === 'month'" type="info" size="small" @click="nextMonth" aria-label="下月">
          ›
        </BaseButton>
      </div>
    </div>
    <div class="cal-weekdays">
      <div v-for="(w, i) in weekdayLabels" :key="i" class="cal-weekday">{{ w }}</div>
    </div>
    <div class="cal-grid" :class="{ 'cal-grid--week': viewMode === 'week' }">
      <button
        v-for="(cell, i) in displayCells"
        :key="`${cell.dateKey}-${i}-${viewMode}`"
        type="button"
        class="cal-cell"
        :class="{
          'cal-cell--muted': viewMode === 'month' && !cell.inMonth,
          'cal-cell--today': cell.isToday,
          'cal-cell--marked': cell.hasHighlight,
        }"
        @click="onSelectCell(cell)"
      >
        {{ cell.day }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.study-calendar {
  min-width: 280px;
  max-width: 360px;
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
}

.cal-header-lead {
  width: 2rem;
  flex-shrink: 0;
}

.cal-title {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 14px;
  text-align: center;
  line-height: 1.3;
}

.cal-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cal-toggle {
  min-width: 2rem;
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 6px;
}

.cal-weekday {
  text-align: center;
  font-size: 12px;
  color: #888;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;

  &--week {
    grid-template-columns: repeat(7, 1fr);
  }
}

.cal-cell {
  aspect-ratio: 1;
  min-height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--color-second, #f3f4f6);
  color: inherit;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;

  &:hover {
    filter: brightness(0.97);
  }

  &--muted {
    opacity: 0.45;
  }

  &--marked {
    background: #409eff;
    color: #fff;
    font-weight: 600;
  }

  &--today {
    box-shadow: 0 0 0 2px #409eff inset;
  }

  &--marked.cal-cell--today {
    box-shadow: 0 0 0 2px #fff inset;
  }
}
</style>
