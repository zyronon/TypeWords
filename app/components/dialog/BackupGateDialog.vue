<script setup lang="ts">
import { watch } from 'vue'
import { BaseButton, Dialog } from '@/base'
import { useExport } from '@/core/hooks/export'
import { Toast } from '~/base'

const model = defineModel()
const isDesktop = useRuntimeConfig().public.isDesktop

const { loading: backupLoading, exportData } = useExport()

let backupTriggered = $ref(false)
let backupRequest = 0

watch(model, visible => {
  if (!visible) {
    backupRequest++
    backupTriggered = false
  }
})

async function onBackup() {
  const request = ++backupRequest
  backupTriggered = false
  const disabled = !isDesktop && localStorage.getItem('disable360')
  if (disabled) {
    backupTriggered = true
    return Toast.success('已跳过导出')
  }
  const backup = await exportData('已自动备份数据', 'TypeWords数据备份.zip')
  if (request === backupRequest) backupTriggered = !!model.value && backup instanceof Blob
}
</script>

<template>
  <Dialog v-model="model" title="数据备份">
    <div class="flex flex-col gap-3 p-4 w-100">
      <div>
        进行下一步操作前，请先点击<span class="text-red font-bold"> 数据备份 </span
        >按钮备份当前数据，避免误操作导致数据无法恢复
      </div>

      <div class="flex justify-end mt-4">
        <BaseButton size="large" :loading="backupLoading" @click="onBackup">数据备份</BaseButton>
        <slot :disabled="!backupTriggered"></slot>
      </div>
    </div>
  </Dialog>
</template>
