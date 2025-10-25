<script setup lang="ts">

import {Word} from "@/types/types.ts";
import VolumeIcon from "@/components/icon/VolumeIcon.vue";
import {usePlayWordAudio} from "@/hooks/sound.ts";
import Tooltip from "@/components/base/Tooltip.vue";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()

const props = withDefaults(defineProps<{
  item: Word,
  showTranslate?: boolean
  showWord?: boolean
  showTransPop?: boolean
  hiddenOptionIcon?: boolean
}>(), {
  showTranslate: true,
  showWord: true,
  showTransPop: true,
  hiddenOptionIcon: false,
})

const playWordAudio = usePlayWordAudio()

</script>

<template>
  <div class="common-list-item"
       :class="{hiddenOptionIcon}"
  >
    <div class="left">
      <slot name="prefix" :item="item"></slot>
      <div class="title-wrapper">
        <div class="item-title">
          <span class="word" :class="!showWord && 'word-shadow'">{{ item.word }}</span>
          <span class="phonetic">{{ item.phonetic0 }}</span>
          <VolumeIcon 
            class="volume" 
            @click="playWordAudio(item.word)"
            :title="t('PlayPronunciation')"
          ></VolumeIcon>
        </div>
        <div class="item-sub-title flex flex-col gap-2" v-if="item.trans.length && showTranslate">
          <div v-for="v in item.trans">
            <Tooltip
                v-if="v.cn.length > 30 && showTransPop"
                :title="v.pos + '  ' + v.cn"
            >
              <span>{{ v.pos + '  ' + (v[t('DisplayLanguage')] || v.cn).slice(0, 30) + '...' }}</span>
            </Tooltip>
            <span v-else>{{ v.pos + '  ' + (t('DisplayLanguage') === 'fr' ? v.fr : v.cn) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="right">
      <slot name="suffix" :item="item"></slot>
    </div>
  </div>
</template>


<style scoped lang="scss">

</style>
