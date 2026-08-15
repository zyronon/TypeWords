<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useSettingStore } from '@/core/stores/setting.ts'
import { useDisableEventListener } from '@/core/hooks/event'
import ConflictNoticeText from './ConflictNoticeText.vue'

const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))

let settingStore = useSettingStore()
const model = defineModel()

useDisableEventListener(model)
</script>

<template>
  <Dialog
    v-model="model"
    :title="$t('important_notice')"
    footer
    padding
    :cancel-button-text="$t('dont_show')"
    :confirm-button-text="$t('close')"
    @cancel="settingStore.showConflictNotice2 = false"
  >
    <div class="w-150 center flex-col color-main">
      <ConflictNoticeText />
    </div>
  </Dialog>
</template>
