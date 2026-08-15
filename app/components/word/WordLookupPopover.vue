<script setup lang="ts">
import { BaseButton, BaseIcon, Close, VolumeIcon } from '@/base'
import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/core/stores/setting.ts'
import { usePlayWordAudio } from '@/core/hooks/sound.ts'
import { closeWordLookup, wordLookupState } from '@/core/hooks/useWordLookup.ts'
import { openWordCollectPicker } from '@/core/hooks/useWordCollectPicker.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import TranslationList from './TranslationList.vue'
import { goYoudao } from '@/core/utils'

const { t: $t } = useI18n()
const settingStore = useSettingStore()
const playWordAudio = usePlayWordAudio()

const style = computed(() => ({
  left: `${wordLookupState.x}px`,
  top: `${wordLookupState.y}px`,
}))

const collectTarget = computed(() => {
  if (wordLookupState.data) return wordLookupState.data
  if (wordLookupState.queryWord) return getDefaultWord({ word: wordLookupState.queryWord })
  return null
})

function openCollect(e: MouseEvent) {
  e.stopPropagation()
  const target = collectTarget.value
  if (target) openWordCollectPicker(target, e.currentTarget as HTMLElement)
}

function onDocumentClick(e: MouseEvent) {
  const popover = document.querySelector('.word-lookup-popover')
  if (popover && !popover.contains(e.target as Node)) {
    closeWordLookup()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeWordLookup()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

watch(
  () => [wordLookupState.visible, wordLookupState.x, wordLookupState.y],
  () => {
    if (!wordLookupState.visible) return
    nextTick(() => {
      const el = document.querySelector('.word-lookup-popover') as HTMLElement | null
      if (!el) return
      const rect = el.getBoundingClientRect()
      let left = wordLookupState.x - rect.width / 2
      let top = wordLookupState.y
      const padding = 8
      if (left < padding) left = padding
      if (left + rect.width > window.innerWidth - padding) {
        left = window.innerWidth - rect.width - padding
      }
      if (top + rect.height > window.innerHeight - padding) {
        top = wordLookupState.y - rect.height - 16
      }
      el.style.left = `${left}px`
      el.style.top = `${top}px`
    })
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="wordLookupState.visible" class="word-lookup-popover" :style="style" @click.stop>
        <Close class="close-btn" :title="$t('close')" @click="closeWordLookup" />

        <template v-if="wordLookupState.loading">
          <div class="text-sm color-gray py-2 pr-5">查询中...</div>
        </template>
        <template v-else-if="wordLookupState.notFound">
          <div class="flex items-center gap-2 flex-wrap pr-5">
            <span class="text-lg font-medium">{{ wordLookupState.queryWord }}</span>
            <VolumeIcon :simple="true" :cb="() => playWordAudio(wordLookupState.queryWord)" />
            <BaseIcon v-if="collectTarget" @click="openCollect" :title="$t('collect_to_dict')">
              <IconFluentStarAdd16Regular />
            </BaseIcon>
          </div>
          <div class="color-gray mt-1 flex items-center gap-2">
            <span>暂未收录该单词</span>
            <BaseButton @click="goYoudao(wordLookupState.queryWord)">
              <div class="flex items-center gap-2">
                <IconFluentSearch20Regular />
                <span>有道词典</span>
              </div>
            </BaseButton>
          </div>
        </template>
        <template v-else-if="wordLookupState.data">
          <div class="flex items-center gap-1 flex-wrap pr-7">
            <span class="text-lg font-medium">{{ wordLookupState.data.word }}</span>
            <span v-if="settingStore.soundType === 'uk' && wordLookupState.data.phonetic0" class="text-sm color-gray">
              /{{ wordLookupState.data.phonetic0 }}/
            </span>
            <span v-if="settingStore.soundType === 'us' && wordLookupState.data.phonetic1" class="text-sm color-gray">
              /{{ wordLookupState.data.phonetic1 }}/
            </span>
            <VolumeIcon :cb="() => playWordAudio(wordLookupState.data!.word)" />
            <BaseIcon @click="openCollect" :title="$t('collect_to_dict')">
              <IconFluentStarAdd16Regular />
            </BaseIcon>
          </div>
          <TranslationList
            v-if="wordLookupState.data.trans?.length"
            class="mt-2"
            :word="wordLookupState.data"
            :show-full="true"
            :pos-space="false"
          />
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.word-lookup-popover {
  position: fixed;
  z-index: 10000;
  max-width: 22rem;
  min-width: 15rem;
  transform: translateX(-50%);
  background: var(--color-tooltip-bg);
  border: 1px solid var(--color-item-border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
}

.close-btn {
  position: absolute;
  top: 1.1rem;
  right: 1rem;
  z-index: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
