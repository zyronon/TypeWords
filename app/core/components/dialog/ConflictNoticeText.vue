<script setup lang="ts">
import { jump2Feedback } from '../../utils'
import WeChat from '../channel-icons/WeChat.vue'

withDefaults(
  defineProps<{
    type?: 'all' | 'del' | 'keyboard'
  }>(),
  {
    type: 'all',
  }
)
</script>

<template>
  <div class="text">
    <div class="title" v-if="type === 'all'">{{ $t('conflict_notice_title') }}</div>
    <ul>
      <li v-if="type === 'all' || type === 'keyboard'">
        <div class="title" v-if="type === 'all'">{{ $t('keyboard_no_response') }}</div>
        <div>
          <div class="text">
            {{ $t('check_plugins_installed') }}
            <span class="text-xl font-bold text-red-500">{{ $t('conflict_plugin_names') }}</span>
            {{ $t('plugins_intercept_keyboard') }}<span class="font-bold text-red">{{ $t('cause_no_response') }}</span
            >{{ $t('follow_steps_to_resolve') }}
          </div>
          <ul class="m-0">
            <li>{{ $t('try_incognito_mode') }}</li>
            <li>
              {{ $t('incognito_not_working')
              }}<span class="color-link mx-1 cp" @click="jump2Feedback">{{ $t('click_here') }}</span
              >{{ $t('feedback_or_wechat') }}<WeChat />
            </li>
            <li>{{ $t('incognito_working') }}</li>
            <li>{{ $t('disable_plugin_or_exclude') }}</li>
            <li>
              {{ $t('install_extension_manager') }}
              <a
                href="https://chromewebstore.google.com/detail/one-click-extensions-mana/pbgjpgbpljobkekbhnnmlikbbfhbhmem"
                target="_blank"
                >{{ $t('chrome_extension') }}</a
              >,
              <a
                href="https://microsoftedge.microsoft.com/addons/detail/%E5%BF%AB%E6%8D%B7%E6%89%A9%E5%B1%95%E7%AE%A1%E7%90%86/jdodenbllldnoogfmbmmgpieafbnaogm"
                target="_blank"
                >{{ $t('edge_extension') }}</a
              >, {{ $t('to_manage_extensions') }}
            </li>
          </ul>
        </div>
      </li>
      <li v-if="type === 'all' || type === 'del'">
        <div class="title" v-if="type === 'all'">{{ $t('delete_key_goes_back') }}</div>
        <div>{{ $t('browser_360_shortcut') }}</div>
        <div>{{ $t('change_browser_or_shortcut') }}</div>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss"></style>
