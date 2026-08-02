<script setup lang="ts">
import { useBaseStore } from '../../stores/base.ts'
import { BaseButton, Loading, Progress } from '@typewords/base'
import type { PracticeData } from '../../types'
import { ShortcutKey, WordPracticeMode } from '../../types'
import { emitter, EventKey, useEvents } from '../../utils/eventBus'
import { useSettingStore } from '../../stores/setting.ts'
import { usePracticeStore } from '../../stores/practice.ts'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { defineAsyncComponent, inject, watch } from 'vue'
import isoWeek from 'dayjs/plugin/isoWeek'
import { msToHourMinute } from '../../utils'
import ChannelIcons from '../channel-icons/ChannelIcons.vue'
import { useI18n } from 'vue-i18n'

dayjs.extend(isoWeek)
dayjs.extend(isBetween)
const { t: $t } = useI18n()
const Dialog = defineAsyncComponent(() => import('@typewords/base/Dialog'))

const props = defineProps({
  loading: Boolean,
})
const store = useBaseStore()
const settingStore = useSettingStore()
const statStore = usePracticeStore()
const model = defineModel({ default: false })
let list = $ref([])
let practiceData = inject<PracticeData>('practiceData')

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
watch([model, () => props.loading], async newVal => {
  if (newVal && !props.loading) {
    console.log('计算本周学习记录')
    calcWeekList() // 计算本周学习记录
  }
})

const close = () => (model.value = false)

useEvents([
  //特意注释掉，因为在练习界面用快捷键下一组时，需要判断是否在结算界面
  // [ShortcutKey.NextChapter, close],
  [ShortcutKey.RepeatChapter, close],
  [ShortcutKey.DictationChapter, close],
])

function options(emitType: string) {
  emitter.emit(EventKey[emitType])
  close()
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
    <div class="p-8 pr-3 bg-[var(--bg-card-primary)] rounded-2xl">
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

          <div class="w-full gap-3 flex">
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
          <div class="flex min-w-130 justify-center">
            <BaseButton
              :keyboard="settingStore.shortcutKeyMap[ShortcutKey.RepeatChapter]"
              @click="options(EventKey.repeatStudy)"
            >
              <div class="center gap-2">
                <IconFluentArrowClockwise20Regular />
                {{ $t('relearn') }}
              </div>
            </BaseButton>
            <BaseButton
              v-if="settingStore.wordPracticeMode !== WordPracticeMode.Review"
              :keyboard="settingStore.shortcutKeyMap[ShortcutKey.NextChapter]"
              @click="options(EventKey.continueStudy)"
            >
              <div class="center gap-2">
                <IconFluentPlay20Regular />
                {{ store.sdict.complete ? $t('start_from_beginning') : $t('another_group') }}
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
  // 弹窗容器优化
  .w-140 {
    width: 90vw !important;
    max-width: 500px;
    padding: 1.5rem !important;
  }

  // 标题优化
  .center.text-2xl {
    font-size: 1.3rem;
    margin-bottom: 1rem;
  }

  // 统计数据布局
  .flex .flex-1 {
    .text-sm {
      font-size: 0.8rem;
    }

    .text-4xl {
      font-size: 2rem;
    }
  }

  // 时间显示
  .text-xl {
    font-size: 1rem;

    .text-2xl {
      font-size: 1.5rem;
    }
  }

  // 错词/正确统计卡片
  .flex.justify-center.gap-10 {
    gap: 1rem;
    flex-wrap: wrap;

    > div {
      padding: 0.8rem 2rem;

      .text-3xl {
        font-size: 1.8rem;
      }
    }
  }

  // 本周学习记录
  .flex.gap-4 {
    gap: 0.5rem;

    .w-8.h-8 {
      width: 2rem;
      height: 2rem;
      font-size: 0.9rem;
    }
  }

  // 按钮组
  .flex.justify-center.gap-4 {
    flex-direction: column;
    gap: 0.5rem;

    .base-button {
      width: 100%;
      min-height: 48px;
    }
  }
}

@media (max-width: 480px) {
  .w-140 {
    width: 95vw !important;
    padding: 1rem !important;
  }

  .flex .flex-1 {
    .text-4xl {
      font-size: 1.5rem;
    }
  }
}
</style>

<style scoped>
.item {
  @apply bg-[var(--bg-card-secend)] rounded-xl p-2 text-center border border-gray-100;
}
</style>
