<script setup lang="ts">
import type { Word } from '@/core/types'
import { usePlayWordAudio } from '@/core/hooks/sound.ts'
import { BaseIcon, VolumeIcon } from '@/base'
import { useWordOptions } from '@/core/hooks/dict.ts'
import { openWordCollectPicker } from '@/core/hooks/useWordCollectPicker.ts'
import TranslationList from './TranslationList.vue'

const props = withDefaults(
  defineProps<{
    item: Word
    showTranslate?: boolean
    showWord?: boolean
    showTransPop?: boolean
    showOption?: boolean
    showCollectIcon?: boolean
    showMarkIcon?: boolean
    index?: number
    active?: boolean
    disabled?: boolean
    excludeDictId?: string
  }>(),
  {
    showTranslate: true,
    showWord: true,
    showTransPop: true,
    showOption: true,
    showCollectIcon: true,
    showMarkIcon: true,
    active: false,
    disabled: false,
  }
)

const playWordAudio = usePlayWordAudio()

const { isWordCollect, toggleWordCollect, isWordSimple, toggleWordSimple } = useWordOptions()

function openCollectPicker(e: MouseEvent) {
  openWordCollectPicker(props.item, e.currentTarget as HTMLElement, {
    excludeDictId: props.excludeDictId || undefined,
  })
}
</script>

<template>
  <div class="common-list-item" :class="{ active, disabled }">
    <div class="left">
      <slot name="prefix" :item="item"></slot>
      <div class="title-wrapper">
        <div class="item-title">
          <span class="text-sm translate-y-0.5 text-gray-500" v-if="index != undefined">{{ index }}.</span>
          <span class="word" :class="!showWord && 'word-shadow'">{{ item.word }}</span>
          <span class="phonetic text-gray" :class="!showWord && 'word-shadow'">{{ item.phonetic0 }}</span>
          <VolumeIcon class="volume" @click="playWordAudio(item.word)"></VolumeIcon>
        </div>
        <TranslationList :pos-space="false" :word="item" :showFull="showWord" v-if="showTranslate" />
      </div>
    </div>
    <div class="right" v-if="showOption">
      <slot name="suffix" :item="item"></slot>
      <BaseIcon
        v-if="showCollectIcon"
        :class="!isWordCollect(item) ? 'collect' : 'fill'"
        @click.stop="toggleWordCollect(item)"
        :title="!isWordCollect(item) ? $t('collect') : $t('uncollect')"
      >
        <IconFluentStar16Regular v-if="!isWordCollect(item)" />
        <IconFluentStar16Filled v-else />
      </BaseIcon>

      <BaseIcon
        v-if="showMarkIcon"
        :class="!isWordSimple(item) ? 'collect' : 'fill'"
        @click.stop="toggleWordSimple(item)"
        :title="!isWordSimple(item) ? $t('mark_mastered') : $t('unmark_mastered')"
      >
        <IconFluentCheckmarkCircle16Regular v-if="!isWordSimple(item)" />
        <IconFluentCheckmarkCircle16Filled v-else />
      </BaseIcon>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
