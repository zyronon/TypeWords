<script setup lang="ts">
import { BasePage, Collapse } from '@/base'
import WeChat from '@/components/channel-icons/WeChat.vue'
import { APP_NAME, GITHUB, Origin } from '@/core/config/env.ts'
import ConflictNoticeText from '@/components/dialog/ConflictNoticeText.vue'

let title = APP_NAME + ' 常见问题解答'
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
            q="数据丢失/被清空/不在了"
            :a="[
              '360的垃圾清理功能，清垃圾的时候会自动清理浏览器数据，网站的数据也会被清除，其他软件的同类功能也可能导致数据被清掉',
              'C盘如果被占满了，是无法保存数据的',
              '无痕模式无法保存数据，关闭浏览器之后数据就没了',
              '开户了“自动清除历史记录”选项也无法保存数据，关闭浏览器之后数据就没了',
            ]"
          >
          </Collapse>

          <div class="line"></div>
          <Collapse :q="$t('qa2_a')">
            <ConflictNoticeText type="keyboard" />
          </Collapse>

          <div class="line"></div>

          <Collapse q="按删除键却返回了上一页">
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
              {{ $t('wechat_group') }}：
              <WeChat />
            </div>
            <p>
              {{ $t('github_address') }}： <a :href="GITHUB" target="_blank">{{ GITHUB }}</a>
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
