<script setup lang="ts">
import { usePracticeStore } from '../../stores/practice'
import { useSettingStore } from '../../stores/setting'
import type { PracticeData } from '../../types'
import { ShortcutKey, WordPracticeMode, WordPracticeStage } from '../../types'
import { BaseIcon, Tooltip } from '@typewords/base'
import SettingDialog from '../setting/SettingDialog.vue'
import VolumeSettingMiniDialog from './VolumeSettingMiniDialog.vue'
import StageProgress from '../StageProgress.vue'
import { WordPracticeModeNameMap, WordPracticeStageNameMap } from '../../config/env'
import { useI18n } from 'vue-i18n'

const statStore = usePracticeStore()
const settingStore = useSettingStore()
const { t: $t } = useI18n()

defineProps<{
  showEdit?: boolean
}>()

const emit = defineEmits<{
  edit: []
  skipStep: []
}>()

let practiceData = inject<PracticeData>('practiceData')
const bumpPracticeTimerActivity = inject<(() => void) | undefined>('bumpPracticeTimerActivity', undefined)

function onTimerRowClick() {
  if (statStore.timerPaused) {
    statStore.resumeTimer()
    bumpPracticeTimerActivity?.()
  } else {
    statStore.pauseTimer('manual')
  }
}

function format(val: number, suffix: string = '', check: number = -1) {
  return val === check ? '-' : val + suffix
}

const status = $computed(() => {
  if (settingStore.wordPracticeMode === WordPracticeMode.Free) return $t('free_practice')
  if (practiceData.isTypingWrongWord) return $t('review_wrong_words')
  return statStore.getStageName
})

const stages = $computed(() => {
  let DEFAULT_BAR = {
    name: '',
    ratio: 100,
    percentage: (practiceData.index / practiceData.words.length) * 100,
    active: true,
  }
  if ([WordPracticeMode.Shuffle, WordPracticeMode.Free].includes(settingStore.wordPracticeMode)) {
    return [DEFAULT_BAR]
  } else {
    // 阶段映射：将 WordPracticeStage 映射到 stageIndex 和 childIndex
    const stageMap: Partial<Record<WordPracticeStage, { stageIndex: number; childIndex: number }>> = {
      [WordPracticeStage.FollowWriteNewWord]: { stageIndex: 0, childIndex: 0 },
      [WordPracticeStage.IdentifyNewWord]: { stageIndex: 0, childIndex: 0 },
      [WordPracticeStage.ListenNewWord]: { stageIndex: 0, childIndex: 1 },
      [WordPracticeStage.DictationNewWord]: { stageIndex: 0, childIndex: 2 },
      [WordPracticeStage.IdentifyReview]: { stageIndex: 1, childIndex: 0 },
      [WordPracticeStage.ListenReview]: { stageIndex: 1, childIndex: 1 },
      [WordPracticeStage.DictationReview]: { stageIndex: 1, childIndex: 2 },
    }

    // console.log('statStore.stage',statStore.stage)
    // 获取当前阶段的配置
    const currentStageConfig = stageMap[statStore.stage]
    if (!currentStageConfig) {
      return [DEFAULT_BAR]
    }
    const { stageIndex, childIndex } = currentStageConfig
    const currentProgress = (practiceData.index / practiceData.words.length) * 100

    if (
      [WordPracticeMode.IdentifyOnly, WordPracticeMode.DictationOnly, WordPracticeMode.ListenOnly].includes(
        settingStore.wordPracticeMode
      )
    ) {
      const stages = [
        {
          name: `新词：${WordPracticeModeNameMap[settingStore.wordPracticeMode]}`,
          ratio: 49,
          percentage: 0,
          active: false,
        },
        {
          name: `复习：${WordPracticeModeNameMap[settingStore.wordPracticeMode]}`,
          ratio: 49,
          percentage: 0,
          active: false,
        },
      ]

      // 设置已完成阶段的百分比和比例
      for (let i = 0; i < stageIndex; i++) {
        stages[i].percentage = 100
        stages[i].ratio = 49
      }

      // 设置当前激活的阶段
      stages[stageIndex].active = true
      stages[stageIndex].percentage = (practiceData.index / practiceData.words.length) * 100
      return stages
    } else {
      // 阶段配置：定义每个阶段组的基础信息
      const stageConfigs = [
        {
          name: '新词',
          ratio: 70,
          children: [
            { name: WordPracticeStageNameMap[WordPracticeStage.FollowWriteNewWord] },
            { name: WordPracticeStageNameMap[WordPracticeStage.ListenNewWord] },
            { name: WordPracticeStageNameMap[WordPracticeStage.DictationNewWord] },
          ],
        },
        {
          name: '复习',
          ratio: 30,
          children: [
            { name: WordPracticeStageNameMap[WordPracticeStage.IdentifyReview] },
            { name: WordPracticeStageNameMap[WordPracticeStage.ListenReview] },
            { name: WordPracticeStageNameMap[WordPracticeStage.DictationReview] },
          ],
        },
      ]

      // 初始化 stages
      const stages = stageConfigs.map(config => ({
        name: config.name,
        percentage: 0,
        ratio: config.ratio,
        active: false,
        children: config.children.map(child => ({
          name: child.name,
          percentage: 0,
          ratio: 33,
          active: false,
        })),
      }))

      // 设置已完成阶段的百分比和比例
      for (let i = 0; i < stageIndex; i++) {
        stages[i].percentage = 100
        stages[i].ratio = 30
      }

      // 设置当前激活的阶段
      stages[stageIndex].ratio = 70
      stages[stageIndex].active = true

      // 根据类型设置子阶段的进度
      const currentStageChildren = stages[stageIndex].children

      if (childIndex === 0) {
        // 跟写/自测：只激活第一个子阶段
        currentStageChildren[0].active = true
        currentStageChildren[0].percentage = currentProgress
      } else if (childIndex === 1) {
        // 听写：第一个完成，第三个未开始，第二个进行中
        currentStageChildren[0].active = false
        currentStageChildren[1].active = true
        currentStageChildren[2].active = false
        currentStageChildren[0].percentage = 100
        currentStageChildren[1].percentage = currentProgress
        currentStageChildren[2].percentage = 0
      } else if (childIndex === 2) {
        // 默写：前两个完成，第三个进行中
        currentStageChildren[0].active = false
        currentStageChildren[1].active = false
        currentStageChildren[2].active = true
        currentStageChildren[0].percentage = 100
        currentStageChildren[1].percentage = 100
        currentStageChildren[2].percentage = currentProgress
      }

      if (settingStore.wordPracticeMode === WordPracticeMode.System) {
        return stages
      }
      if (settingStore.wordPracticeMode === WordPracticeMode.Review) {
        stages.shift()
        if (stageIndex === 1) stages[0].ratio = 100
        return stages
      }
    }
  }
  return [DEFAULT_BAR]
})
</script>

<template>
  <div class="footer">
    <Tooltip
      :title="`${settingStore.showToolbar ? $t('collapse') : $t('expand')}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleToolbar]})`"
    >
      <IconFluentChevronLeft20Filled
        @click="settingStore.showToolbar = !settingStore.showToolbar"
        class="arrow"
        :class="!settingStore.showToolbar && 'down'"
        color="#999"
      />
    </Tooltip>

    <div class="bottom">
      <StageProgress :stages="stages" />

      <div class="flex justify-between items-center">
        <div class="stat">
          <div class="row">
            <Tooltip title="进度 / 单词数">
              <div class="num">{{ `${practiceData.index + 1} / ${practiceData.words.length}` }}</div>
            </Tooltip>
            <div class="line"></div>
            <div class="name">{{ status }}</div>
          </div>
          <div class="row">
            <Tooltip title="点击可暂停或恢复学习计时">
              <div class="num cursor-pointer" @click="onTimerRowClick">
                <template v-if="statStore.timerPaused">
                  <IconFluentPause20Regular width="18" height="18" class="inline-block align-middle" />
                </template>
                <template v-else>
                  {{ Math.floor(statStore.spend / 1000 / 60) }}{{ $t('minutes') }}
                  <!--                  {{statStore.spend /1000}}-->
                </template>
              </div>
            </Tooltip>
            <div class="line"></div>
            <div class="name">{{ $t('time') }}</div>
          </div>
          <div class="row">
            <div class="num">{{ statStore.total }}</div>
            <div class="line"></div>
            <div class="name">{{ $t('total_words') }}</div>
          </div>
          <div class="row">
            <Tooltip title="当前错误数 | 总错误数">
              <div class="num">
                {{ format(practiceData.wrongWords.length, '', 0) }} | {{ format(statStore.wrong, '', 0) }}
              </div>
            </Tooltip>
            <div class="line"></div>
            <div class="name">{{ $t('errors') }}</div>
          </div>
        </div>
        <div class="flex gap-2 justify-center items-center" id="toolbar-icons">
          <SettingDialog type="word" />

          <VolumeSettingMiniDialog />

          <BaseIcon
            v-if="settingStore.wordPracticeMode !== WordPracticeMode.Free"
            @click="emit('skipStep')"
            :title="`${$t('skip_to_next_stage')}:${WordPracticeStageNameMap[statStore.nextStage]}(${settingStore.shortcutKeyMap[ShortcutKey.NextStep]})`"
          >
            <IconFluentArrowRight16Regular />
          </BaseIcon>

          <BaseIcon
            @click="settingStore.dictation = !settingStore.dictation"
            :title="`${$t('toggle_dictation_mode')}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleDictation]})`"
          >
            <IconFluentEyeOff16Regular v-if="settingStore.dictation" />
            <IconFluentEye16Regular v-else />
          </BaseIcon>

          <BaseIcon
            :title="`${$t('toggle_translation')}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleShowTranslate]})`"
            @click="settingStore.translate = !settingStore.translate"
          >
            <IconPhTranslate v-if="settingStore.translate" />
            <IconFluentTranslateOff16Regular v-else />
          </BaseIcon>

          <BaseIcon
            @click="settingStore.showPanel = !settingStore.showPanel"
            :title="`${$t('word_list')}(${settingStore.shortcutKeyMap[ShortcutKey.TogglePanel]})`"
          >
            <IconFluentTextListAbcUppercaseLtr20Regular />
          </BaseIcon>
        </div>
      </div>
    </div>
    <div class="progress-wrap flex gap-3 items-center color-gray">
      <span class="shrink-0">{{ status }}</span>
      <StageProgress :stages="stages" />
      <Tooltip title="进度 / 错误数 / 单词数">
        <div class="shrink-0">
          <span> {{ practiceData.index + 1 }}</span> /
          <span class="color-red"> {{ format(practiceData.wrongWords.length, '', 0) }}</span> /
          <span>{{ practiceData.words.length }}</span>
        </div>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.footer {
  flex-shrink: 0;
  width: var(--toolbar-width);
  position: relative;
  z-index: 20; // 提高z-index确保在最上方

  &.hide {
    margin-bottom: -6rem;
    margin-top: 3rem;

    .progress-wrap {
      bottom: calc(100% + 1.8rem);
    }
  }

  .bottom {
    @apply relative w-full box-border rounded-xl bg-second shadow-lg z-10 mb-3;
    padding: 0.2rem var(--space) calc(0.4rem + env(safe-area-inset-bottom, 0px)) var(--space);

    .stat {
      @apply flex justify-around gap-[var(--stat-gap)] mt-2;

      .row {
        @apply flex flex-col items-center gap-1 text-gray;

        width: 4rem;
        padding: 0 0 0.5rem 0;

        .line {
          height: 1px;
          width: 100%;
          background: var(--color-sub-gray);
        }

        .num {
          line-height: 1;
          height: 1rem;
        }

        .name {
          line-height: 1;
          height: 1rem;
        }
      }
    }
  }

  .progress-wrap {
    width: var(--toolbar-width);
    transition: all 0.3s;
    padding: 0 0.6rem;
    box-sizing: border-box;
    position: fixed;
    bottom: 1rem;
    z-index: 1; // 确保进度条也在最上方
  }

  .arrow {
    position: absolute;
    top: -40%;
    left: 50%;
    cursor: pointer;
    transition: all 0.5s;
    transform: rotate(-90deg);
    padding: 0.5rem;
    font-size: 1.2rem;

    &.down {
      top: -90%;
      transform: rotate(90deg);
    }
  }
}


@media (max-width: 768px) {
  .footer {
    width: 100%;

    .bottom {
      padding: 0.3rem 0.5rem 0.5rem 0.5rem;
      border-radius: 0.4rem;

      .stat {
        margin-top: 0.3rem;
        gap: 0.2rem;
        flex-direction: row;
        overflow-x: auto;

        .row {
          min-width: 3.5rem;
          gap: 0.2rem;

          .num {
            font-size: 0.8rem;
            font-weight: bold;
          }

          .name {
            font-size: 0.7rem;
          }
        }
      }

      // 移动端按钮组调整 - 改为网格布局
      .flex.gap-2 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.4rem;
        justify-content: center;

        .base-icon {
          padding: 0.3rem;
          font-size: 1rem;
          min-height: 44px;
          min-width: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
    }

    .progress-wrap {
      width: 100%;
      padding: 0 0.5rem;
      bottom: 0.5rem;
    }

    .arrow {
      font-size: 1rem;
      padding: 0.3rem;
    }
  }
}

// 超小屏幕适配
@media (max-width: 480px) {
  .footer {
    .bottom {
      padding: 0.2rem 0.3rem 0.3rem 0.3rem;

      .stat {
        margin-top: 0.2rem;
        gap: 0.1rem;

        .row {
          min-width: 3rem;
          gap: 0.1rem;

          .num {
            font-size: 0.7rem;
          }

          .name {
            font-size: 0.6rem;
          }

          // 隐藏部分统计信息，只保留关键数据
          &:nth-child(n + 3) {
            display: none;
          }
        }
      }

      .flex.gap-2 {
        gap: 0.2rem;

        .base-icon {
          padding: 0.2rem;
          font-size: 0.9rem;
        }
      }
    }

    .progress-wrap {
      padding: 0 0.3rem;
      bottom: 0.3rem;
    }
  }
}
</style>
