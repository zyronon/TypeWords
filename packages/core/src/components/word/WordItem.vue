<script setup lang="ts">
import type { Word } from '../../types'
import { usePlayWordAudio } from '../../hooks/sound.ts'
import { BaseIcon, Tooltip, VolumeIcon } from '@typewords/base'
import { useWordOptions } from '../../hooks/dict.ts'
import { useWordHydrator } from '../../hooks/useWordHydrator'
import TranslationList from './TranslationList.vue'
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

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

const { hydrate } = useWordHydrator()
const router = useRouter()

let hydrateFailed = $ref(false)
let missingDictName = $ref('')

async function doHydrate(item: Word) {
  const result = await hydrate(item)
  if (!result.hydrated && result.dictName) {
    hydrateFailed = true
    missingDictName = result.dictName
  } else if (result.hydrated) {
    hydrateFailed = false
  }
}

function goDictList() {
  router.push('/dict-list')
}

onMounted(() => {
  doHydrate(props.item)
})

watch(
  () => props.item,
  val => {
    doHydrate(val)
  }
)
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
        <TranslationList :pos-space="false" :word="item" :showFull="showWord" v-if="showTranslate && !hydrateFailed" />
        <div v-else-if="showTranslate && hydrateFailed" class="missing-dict-hint" @click="goDictList">
          下载 {{ missingDictName }} 查看释义
        </div>
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

<style scoped lang="scss">
.missing-dict-hint {
  color: var(--color-sub-text);
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s;
}
.missing-dict-hint:hover {
  color: var(--color-icon-hightlight);
}
</style>
