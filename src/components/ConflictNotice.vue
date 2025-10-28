<script setup lang="ts">

import {defineAsyncComponent, onMounted, watch} from "vue";
import {useSettingStore} from "@/stores/setting.ts";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()
const Dialog = defineAsyncComponent(() => import('@/components/dialog/Dialog.vue'))

let settingStore = useSettingStore()
let show = $ref(false)

watch(() => settingStore.load, (n) => {
  if (n && settingStore.conflictNotice) {
    setTimeout(() => {
      show = true
    }, 300)
  }
}, {immediate: true})

</script>

<template>
  <Dialog v-model="show"
          :title="t('Hint')"
          footer
          :cancel-button-text="t('DontRemindAgain')"
          :confirm-button-text="t('Close')"
          @cancel="settingStore.conflictNotice = false"
  >
    <div class="card w-120 center flex-col color-main py-0 mb-0">
      <div>
        <div class="text">
          1、 {{ t('SpeedControlWarning') }}
        </div>
        <div class="pl-4">
          <div>{{ t('ExcludeInSettings') }}</div>
          <div>{{ t('DisableTemporarily') }}</div>
        </div>
        <div class="text mt-2">
          2、{{ t('NoExtensionIssue') }}
        </div>
        <div class="pl-4">
          <div>{{ t('TryIncognitoMode') }}</div>
          <div>{{ t('ReportBugIncognito') }}</div>
        </div>
      </div>
    </div>
  </Dialog>
</template>
