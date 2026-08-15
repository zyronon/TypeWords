<script setup lang="ts">
import { Close } from '@/base'
import { useI18n } from 'vue-i18n'
import { useNav } from '@/core/utils'
import type { ReleaseFeatureType } from '@/core/config/releaseNotes'
import { useReleaseNotification } from '@/core/composables/useReleaseNotification'

const { currentRelease, hasUnseenRelease, markReleaseSeen } = useReleaseNotification()
const { nav } = useNav()
const { t } = useI18n()

const featureTypeClass: Record<ReleaseFeatureType, string> = {
  new: 'bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-200',
  improve: 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200',
  fix: 'bg-gray-500/15 text-gray-600 dark:bg-gray-400/20 dark:text-gray-300',
}

const featureTypeLabel: Record<ReleaseFeatureType, string> = {
  new: 'release_feature_new',
  improve: 'release_feature_improve',
  fix: 'release_feature_fix',
}

function goToReleases() {
  nav('/releases')
}

function dismiss() {
  markReleaseSeen()
}
</script>

<template>
  <div
    v-if="hasUnseenRelease && currentRelease"
    class="relative mb-4 card px-4 py-3 rounded-xl cp bg-gradient-to-r from-violet-50 via-blue-50 to-indigo-50 dark:from-violet-950/50 dark:via-blue-950/30 dark:to-indigo-950/40 border border-violet-200/60 dark:border-violet-700/40 transition-all duration-200 hover:opacity-95 shadow-sm hover:shadow-md"
    @click="goToReleases"
  >
    <Close class="absolute top-4 right-4 z-1" :circle="false" @click.stop="dismiss" />

    <div class="flex items-start gap-2.5 pr-8">
      <div
        class="w-8 h-8 flex-shrink-0 center rounded-lg mt-0.5 bg-gradient-to-br from-violet-400 to-indigo-500 dark:from-violet-600 dark:to-indigo-700"
      >
        <IconFluentSparkle20Regular class="text-base text-white" />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-700 leading-tight">
            {{ currentRelease.title }}
          </span>
        </div>

        <p class="mt-1 leading-snug">
          {{ currentRelease.summary }}
        </p>

        <ul class="mt-2 space-y-2 pl-0">
          <li
            v-for="(feature, idx) in currentRelease.features"
            :key="idx"
            class="flex items-center gap-1.5 leading-snug"
          >
            <span
              class="inline-flex items-center px-2 py-0.5 rounded font-500 shrink-0 mt-px"
              :class="featureTypeClass[feature.type]"
            >
              {{ t(featureTypeLabel[feature.type]) }}
            </span>
            <span>
              <span class="font-600" v-if="feature.title">{{ feature.title }} — </span>
              <span v-if="feature.desc">{{ feature.desc }} </span>
            </span>
          </li>
        </ul>

        <div class="mt-2 flex justify-between">
          <div class="flex items-center">
            <span>{{ t('release_banner_cta') }}</span>
            <IconFluentChevronRight16Regular />
          </div>
          <span> 更新日期：{{ currentRelease.date }} </span>
        </div>
      </div>
    </div>
  </div>
</template>
