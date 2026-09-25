<script setup lang="ts">
import { BasePage, Collapse } from '@/base'
import WeChat from '@/components/channel-icons/WeChat.vue'
import { APP_NAME, GITHUB, Origin } from '@/core/config/env.ts'
import ConflictNoticeText from '@/components/dialog/ConflictNoticeText.vue'

let title = APP_NAME + ' FAQ'
let route = useRoute()
useSeoMeta({
  title: title,
  description: title,
  ogTitle: title,
  ogDescription: title,
  ogUrl: Origin + route.fullPath,
  twitterTitle: title,
  twitterDescription: title,
})
</script>

<template>
  <BasePage>
    <div class="center">
      <div class="card-white qa w-2/3">
        <div class="font-bold text-2xl mb-6">{{ $t('faq') }}</div>
        <div class="list">
          <Collapse
            q="My data is lost / cleared / gone"
            :a="[
              'The junk cleaner in 360 Security wipes browser data when it runs, which also deletes this site\'s data. Similar features in other software can do the same',
              'Data cannot be saved when your C: drive is full',
              'Incognito/private mode cannot keep data; it is gone once you close the browser',
              'If “Clear history on exit” is enabled, data cannot be kept either; it is gone once you close the browser',
            ]"
          >
          </Collapse>

          <div class="line"></div>
          <Collapse :q="$t('qa2_a')">
            <ConflictNoticeText type="keyboard" />
          </Collapse>

          <div class="line"></div>

          <Collapse q="Pressing Backspace takes me back to the previous page">
            <ConflictNoticeText type="del" />
          </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa10_a')" :a="[$t('qa10_q1'), $t('qa10_q2')]"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa11_a')" :a="$t('qa11_q')"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa3_a')" :a="[$t('qa3_q1'), $t('qa3_q2'), $t('qa3_q3')]"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa1_a')" :a="[$t('qa1_q1'), $t('qa1_q2')]" />

          <div class="line"></div>

          <Collapse :q="$t('qa4_a')" :a="[$t('qa4_q1'), $t('qa4_q2')]"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa5_a')" :a="[$t('qa5_q1'), $t('qa5_q2'), $t('qa5_q3'), $t('qa5_q4')]"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa6_a')" :a="$t('qa5_q4')"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa7_a')" :a="[$t('qa7_q1'), $t('qa7_q2'), $t('qa7_q3')]"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa8_a')" :a="[$t('qa8_q1'), $t('qa8_q2'), $t('qa8_q3')]"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa9_a')" :a="$t('qa9_q')"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa12_a')" :a="$t('qa12_q')"> </Collapse>

          <div class="line"></div>

          <Collapse :q="$t('qa13_a')" :a="[$t('qa13_q1'), $t('qa13_q2'), $t('qa13_q3'), $t('qa13_q4')]">
            <div class="flex items-center">
              {{ $t('wechat_group') }}:
              <WeChat />
            </div>
            <p>
              {{ $t('github_address') }}: <a :href="GITHUB" target="_blank">{{ GITHUB }}</a>
            </p>
            <div class="">
              {{ $t('about_ticket_feedback')
              }}<a :href="`https://v.wjx.cn/vm/ev0W7fv.aspx#`" target="_blank">https://v.wjx.cn/vm/ev0W7fv.aspx#</a>
            </div>
          </Collapse>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss"></style>
