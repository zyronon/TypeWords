<script setup lang="ts">
let showIEDialog = $ref(false)

onMounted(() => {
  // 检测 IE 浏览器
  const ua = navigator.userAgent || ''
  const isIE = !!(document as any).documentMode || /MSIE|Trident/i.test(ua)
  if (isIE) {
    showIEDialog = true
  }
})
function closeIEDialog() {
  showIEDialog = false
}
</script>

<template>
  <!-- IE 浏览器提示对话框 -->
  <Teleport to="body">
    <div v-if="showIEDialog" class="ie-mask" @click="closeIEDialog">
      <div class="ie-dialog space-y-4" @click.stop>
        <div class="text-xl font-bold">{{ $t('ie_not_supported') }}</div>
        <div class="text-base">
          {{ $t('ie_use_modern_browser') }}
        </div>
        <div class="flex justify-end gap-4">
          <a class="btn" href="https://www.google.cn/chrome/" target="_blank" rel="noreferrer">{{ $t('download_chrome') }}</a>
          <button class="btn-secondary" type="button" @click="closeIEDialog">{{ $t('i_understand') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.ie-mask {
  @apply fixed left-0 top-0 right-0 bottom-0 bg-black/35 z-9998;
}

.ie-dialog {
  @apply fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-102 max-w-90vw bg-white text-black rounded-lg shadow-lg z-9999 p-6;
}

.ie-dialog .btn {
  @apply inline-flex items-center justify-center h-8 px-4 rounded-md bg-blue-500 text-white text-sm font-medium no-underline;
}

.ie-dialog .btn-secondary {
  @apply inline-flex items-center justify-center h-8 px-4 rounded-md bg-gray-200 text-gray-800 text-sm font-medium no-underline border border-gray-300 cp;
  border: 1px solid #ddd;
}
</style>
