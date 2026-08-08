<script setup lang="ts">
import { ref } from 'vue'
import { BaseButton, BaseIcon, Toast } from '@/base'

// 小程序二维码推广
const LS_KEY_MINI_QR_DATE = 'tw_mini_qr_last_date'
const LS_KEY_MINI_QR_NEVER = 'tw_mini_qr_never_show'
let showMiniQr = $ref(false)
let miniQrAutoTimer = null

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function isNeverShowMiniQr() {
  return localStorage.getItem(LS_KEY_MINI_QR_NEVER) === '1'
}
function shouldAutoShowMiniQr() {
  if (isNeverShowMiniQr()) return false
  const lastDate = localStorage.getItem(LS_KEY_MINI_QR_DATE)
  if (lastDate === getToday()) return false
  return true
}

function neverShowMiniQr() {
  showMiniQr = false
  if (miniQrAutoTimer) {
    clearTimeout(miniQrAutoTimer)
    miniQrAutoTimer = null
  }
  localStorage.setItem(LS_KEY_MINI_QR_NEVER, '1')
  Toast.success('关闭成功')
}

function handleMiniIconEnter() {
  showMiniQr = true
  if (miniQrAutoTimer) {
    clearTimeout(miniQrAutoTimer)
    miniQrAutoTimer = null
  }
}

function handleMiniIconLeave() {
  showMiniQr = false
}

onMounted(() => {
  if (shouldAutoShowMiniQr()) {
    setTimeout(() => {
      localStorage.setItem(LS_KEY_MINI_QR_DATE, getToday())
      showMiniQr = true
      miniQrAutoTimer = setTimeout(handleMiniIconLeave, 5000)
    }, 1000)
  }
})
</script>

<template>
  <div class="relative z-999" @mouseenter="handleMiniIconEnter" @mouseleave="handleMiniIconLeave">
    <div
      class="pt-2 -right-2 absolute z-999 top-full transition-all duration-300"
      :class="{
        'opacity-0 scale-95 pointer-events-none': !showMiniQr,
        'opacity-100 scale-100 pointer-events-auto': showMiniQr,
      }"
    >
      <div class="card p-3 flex flex-col items-center gap-2">
        <img src="/imgs/mini.png" alt="小程序二维码" class="w-40 h-40 rounded" />
        <span class="">扫码体验小程序</span>
        <BaseButton size="small" @click="neverShowMiniQr" v-if="!isNeverShowMiniQr()"> 不再自动展示 </BaseButton>
      </div>
    </div>
    <BaseIcon>
      <IconTdesignLogoMiniprogram class="color-[var(--color-select-bg)]" />
    </BaseIcon>
  </div>
</template>

<style scoped lang="scss"></style>
