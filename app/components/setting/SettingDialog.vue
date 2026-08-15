<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { BaseIcon } from '@/base'
import CommonSetting from './CommonSetting.vue'
import WordSetting from './WordSetting.vue'
import ArticleSetting from './ArticleSetting.vue'
import SoundSetting from './SoundSetting.vue'
import { useDisableEventListener } from '@/core/hooks/event'

const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

const props = defineProps<{
  type: 'article' | 'word'
  /** 外部传入时直接打开到指定 tab（3 = 音效设置） */
  initialTab?: number
}>()

const emit = defineEmits<{
  (e: 'open'): void
}>()

let tabIndex = $ref(props.type === 'word' ? 1 : 2)
let show = $ref(false)

useDisableEventListener(() => show)

/** 供外部调用：打开弹框并跳转到音效设置 tab */
function openSoundTab() {
  tabIndex = 3
  show = true
}

defineExpose({ openSoundTab })
</script>

<template>
  <Dialog v-model="show" :title="$t('settings')" padding>
    <div class="setting text-lg w-200 h-[60vh] text-md flex flex-col">
      <div class="flex flex-1 overflow-hidden">
        <div class="left">
          <div class="tabs">
            <div class="tab" :class="tabIndex === 1 && 'active'" @click="tabIndex = 1" v-if="type === 'word'">
              <IconFluentTextUnderlineDouble20Regular width="20" />
              <span>{{ $t('word_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 2 && 'active'" @click="tabIndex = 2" v-if="type === 'article'">
              <IconFluentBookLetter20Regular width="20" />
              <span>{{ $t('article_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 0 && 'active'" @click="tabIndex = 0">
              <IconFluentSettings20Regular width="20" />
              <span>{{ $t('general_settings') }}</span>
            </div>
            <div class="tab" :class="tabIndex === 3 && 'active'" @click="tabIndex = 3">
              <IconClarityVolumeUpLine width="20" />
              <span>音效设置</span>
            </div>
          </div>
        </div>
        <div class="content">
          <CommonSetting v-if="tabIndex === 0" />
          <WordSetting v-if="tabIndex === 1" />
          <ArticleSetting v-if="tabIndex === 2" />
          <SoundSetting v-if="tabIndex === 3" />
        </div>
      </div>
    </div>
  </Dialog>
  <BaseIcon
    :title="$t('settings')"
    @click="
      () => {
        show = true
        tabIndex = props.initialTab ?? (props.type === 'word' ? 1 : 2)
      }
    "
  >
    <IconFluentSettings20Regular />
  </BaseIcon>
</template>

<style scoped lang="scss">
.setting {
  .left {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    border-right: 2px solid var(--color-line);

    .tabs {
      padding: 1rem;
      padding-left: 0;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      //color: #0C8CE9;

      .tab {
        @apply cursor-pointer flex items-center relative;
        padding: 0.6rem 0.9rem;
        border-radius: 0.5rem;
        width: 8rem;
        gap: 0.6rem;
        transition: all 0.5s;

        &:hover {
          background: var(--btn-primary);
          color: white;
        }

        &.active {
          background: var(--btn-primary);
          color: white;
        }
      }
    }
  }

  .content {
    flex: 1;
    height: 100%;
    overflow: auto;
    padding: 0 1.6rem;

    .line {
      border-bottom: 1px solid #c4c3c3;
    }
  }
}
</style>
