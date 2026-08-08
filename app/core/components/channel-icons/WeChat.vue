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
        <p>由于微信群二维码有7天限制，为方便更新，故用在线文档分享二维码</p>
        <a href="https://www.kdocs.cn/l/ciNZFKZHCpE2"
           target="_blank">
          >【金山文档 | WPS云文档】 微信群二维码 https://www.kdocs.cn/l/ciNZFKZHCpE2</a
        >
        <!--        <img src="/imgs/channel/wechat.png" :alt="$t('wechat_qrcode')" class="w-70 rounded-xl shadow-lg" />-->
      </div>
    </div>
  </Dialog>
</template>

<style scoped lang="scss"></style>
