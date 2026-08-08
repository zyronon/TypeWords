<script setup lang="ts">
import { useSettingStore } from '../stores/setting.ts'
import { useRouter } from 'vue-router'
import { IS_DEV } from '../config/env'
import { withAppBaseURL } from '../utils/base-url'

const settingStore = useSettingStore()
const router = useRouter()
const darkLogoSrc = withAppBaseURL('/imgs/logo/logo-text-black.png')
const lightLogoSrc = withAppBaseURL('/imgs/logo/logo-text-white.png')

function goHome() {
  if (IS_DEV) {
    router.push('/')
  } else {
    location.href = window.atob('aHR0cHM6Ly90eXBld29yZHMuY2M=')
  }
}
</script>

<template>
  <div class="center mb-2" @click="goHome">
    <img v-show="settingStore.theme === 'dark'" :src="lightLogoSrc" alt="" />
    <img v-show="settingStore.theme !== 'dark'" :src="darkLogoSrc" alt="" />
  </div>
</template>

<style scoped lang="scss">
img {
  cursor: pointer;
  height: 2rem;
}
</style>
