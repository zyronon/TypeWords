<script setup lang="ts">
import { BaseIcon } from '@/base'
import { defineAsyncComponent } from 'vue'
let showWechatDialog = $ref(false)
const Dialog = defineAsyncComponent(() => import('@/base/dialog/Dialog.vue'))
</script>

<template>
  <BaseIcon :title="$t('wechat_group')" @click="showWechatDialog = true">
    <IconSimpleIconsWechat class="color-green-500" />
  </BaseIcon>
  <Dialog v-model="showWechatDialog" :title="$t('wechat_group')">
    <div class="w-120 p-6 pt-0">
      <div class="mb-4">
        {{ $t('community_desc') }}
      </div>
      <div class="text-center">
        <p>WeChat group QR codes expire after 7 days, so the QR code is shared via an online document for easier updates</p>
        <a href="https://www.kdocs.cn/l/ciNZFKZHCpE2"
           target="_blank">
          >[Kingsoft Docs | WPS Cloud Docs] WeChat group QR code https://www.kdocs.cn/l/ciNZFKZHCpE2</a
        >
        <!--        <img src="/imgs/channel/wechat.png" :alt="$t('wechat_qrcode')" class="w-70 rounded-xl shadow-lg" />-->
      </div>
    </div>
  </Dialog>
</template>

<style scoped lang="scss"></style>
