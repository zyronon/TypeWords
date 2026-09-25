<script setup lang="ts">
import { watch } from 'vue'
import { BaseButton, Dialog } from '@/base'
import { useExport } from '@/core/hooks/export'
import { IS_DEV } from '@/core/config/env.ts'
import { Toast } from '~/base'

const model = defineModel()

const { loading: backupLoading, exportData } = useExport()

let backupTriggered = $ref(false)

watch(model, visible => {
  if (!visible) backupTriggered = false
})

async function onBackup() {
  backupTriggered = true
  let disabled = localStorage.getItem('disable360')
  if (disabled) {
    return Toast.success('Export skipped')
  }
  await exportData('Data backed up automatically', 'TypeWords-Data-Backup.zip')
}
</script>

<template>
  <Dialog v-model="model" title="Data Backup">
    <div class="flex flex-col gap-3 p-4 w-100">
      <div>
        Before continuing, click the <span class="text-red font-bold"> Back Up Data </span
        > button to back up your current data, so it can be restored if anything goes wrong
      </div>

      <div class="flex justify-end mt-4">
        <BaseButton size="large" :loading="backupLoading" @click="onBackup">Back Up Data</BaseButton>
        <slot :disabled="!backupTriggered"></slot>
      </div>
    </div>
  </Dialog>
</template>
