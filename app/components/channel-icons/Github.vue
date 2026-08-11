<script setup lang="ts">
import { GITHUB } from '@/core/config/env.ts'
import { BaseIcon } from '@/base'
</script>

<template>
  <a
    :href="GITHUB"
    target="_blank"
    rel="noreferrer"
    :aria-label="$t('github_project')"
    class="color-reverse-black github"
  >
    <BaseIcon title="Github" v-bind="$attrs">
      <IconSimpleIconsGithub />
    </BaseIcon>
  </a>
</template>

<style scoped lang="scss"></style>
