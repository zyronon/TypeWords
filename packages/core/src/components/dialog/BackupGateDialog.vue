<script setup lang="ts">
import { watch } from 'vue'
import { BaseButton, Dialog } from '@typewords/base'
import { useExport } from '../../hooks/export'
import { IS_DEV } from '../../config/env.ts'

const model = defineModel()

const { loading: backupLoading, exportData } = useExport()

let backupTriggered = $ref(false)

watch(model, visible => {
  if (!visible) backupTriggered = false
})

async function onBackup() {
  await exportData('已自动备份数据', 'TypeWords数据备份.zip')
  backupTriggered = true
}
</script>

<template>
  <Dialog v-model="model" title="数据备份">
    <div class="flex flex-col gap-3 p-4 w-100">
      <div>
        进行下一步操作前，请先点击<span class="text-red font-bold"> 数据备份 </span>按钮备份当前数据，避免误操作导致数据无法恢复
      </div>

      <div class="flex justify-end mt-4">
        <BaseButton size="large" :loading="backupLoading" @click="onBackup">数据备份</BaseButton>
        <slot :disabled="!backupTriggered && !IS_DEV"></slot>
      </div>
    </div>
  </Dialog>
</template>
