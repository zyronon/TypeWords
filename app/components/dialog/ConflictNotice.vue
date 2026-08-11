<script setup lang="ts">
import { defineAsyncComponent, watch } from 'vue'
import { useSettingStore } from '@/core/stores/setting.ts'
import { useDisableEventListener } from '@/core/hooks/event'
import ConflictNoticeText from './ConflictNoticeText.vue'
import { BaseButton } from '@/base'

const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

let settingStore = useSettingStore()
let show = $ref(false)
let countDown = $ref(3)

watch(
  () => settingStore.load,
  n => {
    if (n && settingStore.conflictNotice) {
      setTimeout(() => {
        show = true
      }, 300)
      let t = setInterval(() => {
        countDown--
        if (countDown === 0) {
          clearInterval(t)
        }
      }, 1000)
    }
  },
  { immediate: true }
)

useDisableEventListener(() => show)
</script>

<template>
  <Dialog v-model="show" :title="$t('important_notice')" padding :showClose="false" :closeOnClickBg="false">
    <div class="w-150 center flex-col color-main">
      <ConflictNoticeText />

      <div class="flex justify-end w-full mb-4">
        <BaseButton id="dialog-ok" :disabled="countDown > 0" @click="show = settingStore.conflictNotice = false"
          >{{ $t('close') }} <span v-if="countDown">{{ countDown }}</span>
        </BaseButton>
      </div>
    </div>
  </Dialog>
</template>
