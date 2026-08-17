<script setup lang="ts">
import { useBaseStore } from '@/core/stores/base.ts'
import { BaseButton, Progress } from '@/base'
import type { PracticeData } from '@/core/composables/practice-words/practice-word-session.ts'
import { ShortcutKey, WordPracticeMode } from '@/core/types/enum.ts'
import { emitter, useEvents } from '@/core/utils/eventBus.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { usePracticeStore } from '@/core/stores/practice.ts'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { defineAsyncComponent, inject, watch } from 'vue'
import isoWeek from 'dayjs/plugin/isoWeek'
import { msToHourMinute } from '@/core/utils'
import ChannelIcons from '@/components/channel-icons/ChannelIcons.vue'
import { useI18n } from 'vue-i18n'
import saveAs from 'file-saver'
import {
  buildFreePracticeSummary,
  renderFreePracticeSummaryMarkdown,
  renderFreePracticeSummaryText,
} from '@/core/composables/practice-words/practice-summary.ts'

dayjs.extend(isoWeek)
dayjs.extend(isBetween)
const { t: $t } = useI18n()
const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

const props = defineProps({
  loading: Boolean,
})
const store = useBaseStore()
const settingStore = useSettingStore()
const statStore = usePracticeStore()
const model = defineModel({ default: false })
let list = $ref<boolean[]>([])
const practiceData = inject<PracticeData>('practiceData')!
const isFreePractice = $computed(() => settingStore.wordPracticeMode === WordPracticeMode.Free)
const practiceSummary = $computed(() =>
  buildFreePracticeSummary(practiceData.spellingMistakes, settingStore.freePracticeSummaryWrongThreshold)
)

const summaryDocumentInfo = $computed(() => ({
  dictName: store.sdict.name,
  startedAt: dayjs(statStore.startDate).format('YYYY-MM-DD HH:mm:ss'),
  duration: msToHourMinute(statStore.spend, true),
  totalWords: statStore.total,
  newWords: statStore.newWordNumber,
  reviewWords: statStore.reviewWordNumber,
}))

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim() || '未命名词典'
}

function exportPracticeSummary(format: 'txt' | 'md') {
  const content =
    format === 'md'
      ? renderFreePracticeSummaryMarkdown(practiceSummary, summaryDocumentInfo)
      : renderFreePracticeSummaryText(practiceSummary, summaryDocumentInfo)
  const type = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
  const fileName = `自由练习总结-${sanitizeFileName(store.sdict.name)}-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.${format}`
  saveAs(new Blob(['\uFEFF', content], { type }), fileName)
}

function calcWeekList() {
  // 获取本周的起止时间
  const startOfWeek = dayjs().startOf('isoWeek') // 周一
  const endOfWeek = dayjs().endOf('isoWeek') // 周日
  // 初始化 7 天的数组，默认 false
  const weekList = Array(7).fill(false)

  store.sdict.statistics.forEach(item => {
    const date = dayjs(item.startDate)
    if (date.isBetween(startOfWeek, endOfWeek, null, '[]')) {
      let idx = date.day()
      // dayjs().day() 0=周日, 1=周一, ..., 6=周六
      // 需要转换为 0=周一, ..., 6=周日
      if (idx === 0) {
        idx = 6 // 周日放到最后
      } else {
        idx = idx - 1 // 其余前移一位
      }
      weekList[idx] = true
    }
  })
  list = weekList
}

// 监听 model 弹窗打开时重新计算
watch([model, () => props.loading], ([open, loading]) => {
  if (open && !loading) {
    console.log('计算本周学习记录')
    calcWeekList() // 计算本周学习记录
  }
})

const close = () => (model.value = false)

useEvents([
  //特意注释掉，因为在练习界面用快捷键下一组时，需要判断是否在结算界面
  // [ShortcutKey.NextChapter, close],
  [ShortcutKey.RepeatChapter, close],
])

function options(emitType: string) {
  emitter.emit(emitType)
  // “再来一组”由练习页成功初始化下一组后关闭；生成空任务时保留结算弹窗。
  if (emitType !== ShortcutKey.NextChapter) close()
}

// 计算学习进度百分比
const studyProgress = $computed(() => {
  if (!store.sdict.length) return 0
  return Math.round((store.sdict.lastLearnIndex / store.sdict.length) * 100)
})

// 计算正确率
const accuracyRate = $computed(() => {
  if (statStore.total === 0) return 100
  return Math.round(((statStore.total - statStore.wrong) / statStore.total) * 100)
})

// 获取鼓励文案
const encouragementText = $computed(() => {
  const rate = accuracyRate
  if (rate >= 95) return '🎉 ' + $t('encouragement_95')
  if (rate >= 85) return '👍 ' + $t('encouragement_85')
  if (rate >= 70) return '💪 ' + $t('encouragement_70')
  return '🌟 ' + $t('encouragement_default')
})
</script>

<template>
  <Dialog v-model="model" :close-on-click-bg="false" :header="false" :keyboard="false" :show-close="false">
    <div class="p-8 pr-3 bg-[var(--bg-card-primary)] min-w-130 max-h-[90vh] overflow-y-auto rounded-2xl">
      <!-- Header Section -->
      <div class="text-center relative">
        <div
          class="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-500 to-purple-700 bg-clip-text text-transparent"
        >
          <div>🎉 {{ $t('daily_task_complete') }}</div>
        </div>
        <p class="font-medium text-lg">{{ encouragementText }}</p>
      </div>

      <div class="relative">
        <div class="space-y-4" v-opacity="!loading">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="item">
              <IconFluentClock20Regular class="text-purple-500" />
              <div class="text-sm mb-1 font-medium">{{ $t('study_duration') }}</div>
              <div class="text-xl font-bold">{{ msToHourMinute(statStore.spend, true) }}</div>
            </div>

            <div class="item">
              <IconFluentTarget20Regular class="text-purple-500" />
              <div class="text-sm mb-1 font-medium">{{ $t('accuracy_rate') }}</div>
              <div class="text-xl font-bold">{{ accuracyRate }}%</div>
            </div>

            <div class="item">
              <IconFluentSparkle20Regular class="text-purple-500" />
              <div class="text-sm mb-1 font-medium">{{ $t('new_words') }}</div>
              <div class="text-xl font-bold">{{ statStore.newWordNumber }}</div>
            </div>

            <div class="item">
              <IconFluentBook20Regular class="text-purple-500" />
              <div class="text-sm mb-1 font-medium">{{ $t('review') }}</div>
              <div class="text-xl font-bold">
                {{ statStore.reviewWordNumber }}
              </div>
            </div>
          </div>

          <div>
            <div class="font-medium text-lg text-center mb-2">错词统计</div>
            <div class="flex gap-space flex-wrap max-w-150">
              <span
                class="bg-[var(--bg-card-secend)] py-1 px-2 rounded-md"
                v-for="item in Object.entries(practiceData.wrongTimesMap)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)"
              >
                {{ item[0] }}
                {{ item[1] }}次
              </span>
            </div>
          </div>

          <div v-if="isFreePractice" class="bg-[var(--bg-card-secend)] rounded-xl p-4 space-y-4">
            <div class="text-center">
              <div class="font-semibold text-xl">自由练习总结</div>
              <div class="text-sm text-[var(--color-font-3)] mt-1">
                本次共记录 {{ practiceSummary.totalMistakes }} 次拼写错误；以下错词门槛为
                {{ practiceSummary.threshold }} 次
              </div>
            </div>

            <div>
              <div class="font-medium mb-2">错误达到 {{ practiceSummary.threshold }} 次的单词</div>
              <div v-if="practiceSummary.wrongWords.length" class="flex gap-space flex-wrap">
                <span
                  v-for="item in practiceSummary.wrongWords"
                  :key="item.word"
                  class="bg-[var(--bg-card-primary)] py-1 px-2 rounded-md"
                >
                  {{ item.word }} {{ item.count }}次
                </span>
              </div>
              <div v-else class="text-sm text-[var(--color-font-3)]">本次没有达到门槛的单词</div>
            </div>

            <div>
              <div class="font-medium mb-2">常见拼写错误</div>
              <div v-if="practiceSummary.spellingWordGroups.length" class="space-y-3">
                <div
                  v-for="group in practiceSummary.spellingWordGroups.slice(0, 10)"
                  :key="group.word"
                  class="bg-[var(--bg-card-primary)] rounded-lg px-3 py-3 text-sm"
                >
                  <div class="flex justify-between gap-4 mb-2">
                    <span class="font-semibold text-base">{{ group.word }}</span>
                    <span class="whitespace-nowrap font-medium">共 {{ group.totalCount }}次</span>
                  </div>
                  <div class="space-y-1.5">
                    <div
                      v-for="item in group.patterns"
                      :key="item.key"
                      class="flex justify-between gap-4 border-t border-[var(--color-input-border)] pt-1.5"
                    >
                      <span>{{ item.detail }}</span>
                      <span class="whitespace-nowrap">{{ item.count }}次</span>
                    </div>
                  </div>
                </div>
                <div
                  v-if="practiceSummary.spellingWordGroups.length > 10"
                  class="text-sm text-center text-[var(--color-font-3)]"
                >
                  网页仅展示错误次数最高的 10 个单词，导出文件包含全部内容
                </div>
              </div>
              <div v-else class="text-sm text-[var(--color-font-3)]">本次没有记录到拼写错误</div>
            </div>

            <div class="flex justify-end flex-wrap gap-2">
              <BaseButton :disabled="loading" @click="exportPracticeSummary('txt')">导出 TXT</BaseButton>
              <BaseButton :disabled="loading" @click="exportPracticeSummary('md')">导出 Markdown</BaseButton>
            </div>
          </div>

          <div class="summary-main w-full gap-3 flex">
            <div class="space-y-6 flex-1">
              <!-- Weekly Progress -->
              <div class="bg-[--bg-card-secend] rounded-xl p-2">
                <div class="text-center mb-4">
                  <div class="text-xl font-semibold mb-1">{{ $t('weekly_record') }}</div>
                </div>
                <div class="flex justify-between gap-4">
                  <div
                    v-for="(item, i) in list"
                    :key="i"
                    class="flex-1 text-center px-2 py-3 rounded-lg"
                    :class="item ? 'bg-green-500 text-white shadow-lg' : 'bg-white text-gray-700'"
                  >
                    <div class="font-semibold mb-1">{{ i + 1 }}</div>
                    <div
                      class="w-2 h-2 rounded-full mx-auto mb-1"
                      :class="item ? 'bg-white bg-opacity-30' : 'bg-gray-300'"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Progress Overview -->
              <div class="bg-[var(--bg-card-secend)] rounded-xl py-2 px-6">
                <div class="flex justify-between items-center mb-3">
                  <div class="text-xl font-semibold">{{ $t('study_progress') }}</div>
                  <div class="text-2xl font-bold text-purple-600">{{ studyProgress }}%</div>
                </div>
                <Progress :percentage="studyProgress" size="large" :show-text="false" />
                <div class="flex justify-between text-sm font-medium mt-4">
                  <span>{{ $t('learned') }}: {{ store.sdict.lastLearnIndex }}</span>
                  <span>{{ $t('total_words') }}: {{ store.sdict.length }}</span>
                </div>
              </div>
            </div>
            <ChannelIcons />
          </div>
          <!-- Action Buttons -->
          <div class="summary-actions flex justify-center flex-wrap">
            <BaseButton
              :keyboard="settingStore.shortcutKeyMap[ShortcutKey.RepeatChapter]"
              @click="options(ShortcutKey.RepeatChapter)"
            >
              <div class="center gap-2">
                <IconFluentArrowClockwise20Regular />
                {{ $t('relearn') }}
              </div>
            </BaseButton>
            <BaseButton
              :keyboard="settingStore.shortcutKeyMap[ShortcutKey.NextChapter]"
              @click="options(ShortcutKey.NextChapter)"
            >
              <div class="center gap-2">
                <IconFluentPlay20Regular />
                {{ studyProgress === 100 ? $t('start_from_beginning') : $t('another_group') }}
              </div>
            </BaseButton>
            <BaseButton @click="$router.back">
              <div class="center gap-2">
                <IconFluentHome20Regular />
                {{ $t('back_to_home') }}
              </div>
            </BaseButton>
          </div>
        </div>
        <div class="h-full w-full center flex-col absolute top-0 left-0 space-y-2" v-if="loading">
          <IconEosIconsLoading class="text-3xl" />
          <div>结算中...</div>
          <div>请耐心等待，刷新页面可能导致数据丢失</div>
        </div>
      </div>
    </div>
  </Dialog>
</template>
<style scoped lang="scss">
@media (max-width: 768px) {
  .summary-main {
    flex-direction: column;
  }

  .summary-actions {
    flex-direction: column;
    .base-button {
      width: 100%;
      min-height: 48px;
    }
  }

  :deep(.dialog-body) {
    max-width: 95vw;
  }
}
</style>

<style scoped>
.item {
  @apply bg-[var(--bg-card-secend)] rounded-xl p-2 text-center border border-gray-100;
}
</style>
