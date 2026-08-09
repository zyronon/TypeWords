<script setup lang="ts">
import { withAppBaseURL } from '../../utils/base-url'
</script>

<template>
  <div class="h-12 text-xs text-gray-400">
    <span>
      {{ $t('agree_terms_notice') }}
      <a :href="withAppBaseURL('/user-agreement.html')" target="_blank" class="link">{{ $t('user_agreement') }}</a>
      {{ $t('and') }}
      <a :href="withAppBaseURL('/privacy-policy.html')" target="_blank" class="link">{{ $t('privacy_policy') }}</a>
    </span>
    <slot />
  </div>
</template>
