<script setup lang="ts">
import { defineAsyncComponent, watch, onUnmounted } from 'vue'
import { useSettingStore } from '../../stores/setting.ts'
import { useDisableEventListener } from '../../hooks/event.ts'
import ConflictNoticeText from './ConflictNoticeText.vue'
import { BaseButton } from '@typewords/base'

const Dialog = defineAsyncComponent(() => import('@typewords/base/Dialog'))

let settingStore = useSettingStore()
let show = $ref(false)
let countDown = $ref(5)

let _timeout: ReturnType<typeof setTimeout> | null = null
let _interval: ReturnType<typeof setInterval> | null = null

watch(
  () => settingStore.load,
  n => {
    if (n && settingStore.conflictNotice) {
      if (_timeout) clearTimeout(_timeout)
      if (_interval) clearInterval(_interval)
      _timeout = setTimeout(() => {
        show = true
      }, 300)
      _interval = setInterval(() => {
        countDown--
        if (countDown === 0) {
          clearInterval(_interval!)
          _interval = null
        }
      }, 1000)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (_timeout) clearTimeout(_timeout)
  if (_interval) clearInterval(_interval)
})

useDisableEventListener(() => show)
</script>

<template>
  <Dialog
    v-model="show"
    :title="$t('important_notice')"
    padding
    :showClose="false"
    :closeOnClickBg="false"
  >
    <div class="w-150 center flex-col color-main">
      <ConflictNoticeText />

      <div class="flex justify-end w-full mb-4">
        <BaseButton id="dialog-ok" :disabled="countDown>0"
                    @click="show = settingStore.conflictNotice = false"
        >{{ $t('close') }} <span v-if="countDown">{{countDown}}</span>
        </BaseButton>
      </div>
    </div>
  </Dialog>
</template>
