<script setup lang="ts">
import { BaseButton, Toast } from '@/base'
import { sendCode } from '../../apis/user.ts'
import { PHONE_CONFIG } from '../../config/auth.ts'
import { CodeType } from '../../types'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

let isSendingCode = $ref(false)
let codeCountdown = $ref(0)

interface IProps {
  validateField: Function
  type: CodeType
  val: any
  size?: any
}

const props = withDefaults(defineProps<IProps>(), {
  size: 'large',
})

// 发送验证码
async function sendVerificationCode() {
  let res = props.validateField()
  if (res) {
    try {
      isSendingCode = true
      const res = await sendCode({ val: props.val, type: props.type })
      if (res.success) {
        codeCountdown = PHONE_CONFIG.sendInterval
        const timer = setInterval(() => {
          codeCountdown--
          if (codeCountdown <= 0) {
            clearInterval(timer)
          }
        }, 1000)
      } else {
        Toast.error(res.msg || $t('send_failed'))
      }
    } catch (error) {
      console.error('Send code error:', error)
      Toast.error($t('send_code_failed'))
    } finally {
      isSendingCode = false
    }
  }
}
</script>

<template>
  <BaseButton
    @click="sendVerificationCode"
    :disabled="isSendingCode || codeCountdown > 0"
    type="info"
    :size="props.size"
    style="border: 1px solid var(--color-input-border)"
  >
    {{ codeCountdown > 0 ? `${codeCountdown}s` : isSendingCode ? $t('sending') : $t('send_code') }}
  </BaseButton>
</template>

<style scoped lang="scss"></style>
