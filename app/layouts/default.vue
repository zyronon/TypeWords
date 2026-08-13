<script setup lang="ts">
import { BaseIcon, ToastComponent } from '@/base'
import Logo from '@/components/Logo.vue'
import IeDialog from '@/components/dialog/IeDialog.vue'
import useTheme from '@/core/hooks/theme.ts'
import { useRuntimeStore } from '@/core/stores/runtime.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { ShortcutKey } from '@/core/types/enum.ts'
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { useInit } from '@/core/composables/useInit.ts'
import { useI18n } from 'vue-i18n'
import { Supabase } from '@/core/utils/supabase.ts'
import MiniProgram from '@/components/MiniProgram.vue'
import WordCollectPopover from '@/components/word/WordCollectPopover.vue'

const router = useRouter()
const { toggleTheme, getTheme, setTheme } = useTheme()
const runtimeStore = useRuntimeStore()
const settingStore = useSettingStore()
let expand = $ref(false)
const init = useInit()

function toggleExpand(n: boolean) {
  expand = n
  document.documentElement.style.setProperty('--aside-width', n ? '14rem' : '4.5rem')
}

watch(
  () => settingStore.load,
  n => {
    if (!n) return
    toggleExpand(settingStore.sideExpand)
    setTheme(settingStore.theme)
  }
)

watch(
  () => settingStore.theme,
  n => {
    setTheme(n)
  }
)

const { locales, setLocale } = useI18n()
const route = useRoute()

const showIcon = $computed(() => {
  return ['/words', '/articles', '/setting', '/help', '/doc', '/feedback'].includes(route.path)
})

onMounted(() => {
  init()
  window.umami?.track('sync', { check: Supabase.check() })
})

function onMouseEnter() {
  !settingStore.sideExpand && toggleExpand(true)
}

function onMouseLeave() {
  !settingStore.sideExpand && toggleExpand(false)
}
</script>

<template>
  <div class="layout anim">
    <!--    第一个aside 占位用-->
    <div class="aside space"></div>
    <div class="aside fixed" :class="!expand && 'hidden-span'" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
      <div class="top p-4">
        <div v-if="expand" class="flex justify-between">
          <Logo />
          <BaseIcon
            class="transform-scale-80 border border-1 border-solid border-gray"
            @click="settingStore.sideExpand = !settingStore.sideExpand"
          >
            <IconFluentPin24Filled
              v-if="settingStore.sideExpand"
              class="flex-shrink-0 -transform-rotate-45 color-gray"
            />
            <IconFluentPin20Regular v-else class="flex-shrink-0 -transform-rotate-45" />
          </BaseIcon>
        </div>
        <NuxtLink to="/words" class="row">
          <IconFluentTextUnderlineDouble20Regular />
          <span>{{ $t('words') }}</span>
        </NuxtLink>
        <NuxtLink id="article" to="/articles" class="row">
          <IconFluentBookLetter20Regular />
          <span>{{ $t('articles') }}</span>
        </NuxtLink>
        <NuxtLink to="/feedback" class="row">
          <IconFluentCommentEdit20Regular />
          <span>{{ $t('feedback') }}</span>
        </NuxtLink>
        <NuxtLink to="/doc" class="row">
          <IconFluentDocument20Regular />
          <span>{{ $t('document') }}</span>
        </NuxtLink>
        <NuxtLink to="/help" class="row">
          <IconFluentQuestionCircle20Regular />
          <span>{{ $t('help') }}</span>
        </NuxtLink>
        <!--        <div class="row" @click="router.push('/user')">-->
        <!--          <IconFluentPerson20Regular/>-->
        <!--          <span >用户</span>-->
        <!--        </div>-->
      </div>
      <div class="px-4 pb-2 border-0 border-t-1 border-solid border-[var(--color-line)]">
        <NuxtLink to="/setting" class="row">
          <IconFluentSettings20Regular />
          <span>{{ $t('setting') }}</span>
          <div class="red-point" :class="!settingStore.sideExpand && 'top-1 right-0'" v-if="runtimeStore.isError"></div>
        </NuxtLink>
      </div>
    </div>

    <!-- 移动端顶部菜单栏 -->
    <div class="mobile-top-nav" :class="{ collapsed: settingStore.mobileNavCollapsed }">
      <div class="nav-items">
        <div class="nav-item" @click="router.push('/')" :class="{ active: route.path === '/' }">
          <IconFluentHome20Regular />
          <span>{{ $t('home_page') }}</span>
        </div>
        <div class="nav-item" @click="router.push('/words')" :class="{ active: route.path?.includes('/words') }">
          <IconFluentTextUnderlineDouble20Regular />
          <span>{{ $t('words') }}</span>
        </div>
        <div class="nav-item" @click="router.push('/articles')" :class="{ active: route.path?.includes('/articles') }">
          <IconFluentBookLetter20Regular />
          <span>{{ $t('articles') }}</span>
        </div>
        <div class="nav-item" @click="router.push('/setting')" :class="{ active: route.path === '/setting' }">
          <IconFluentSettings20Regular />
          <span>{{ $t('setting') }}</span>
          <div class="red-point" v-if="runtimeStore.isError"></div>
        </div>
      </div>
      <div class="nav-toggle" @click="settingStore.mobileNavCollapsed = !settingStore.mobileNavCollapsed">
        <IconFluentChevronDown20Filled v-if="!settingStore.mobileNavCollapsed" />
        <IconFluentChevronUp20Filled v-else />
      </div>
    </div>

    <IeDialog />

    <div class="flex-1 z-1 relative main-content overflow-x-hidden">
      <div
        class="mt-3 center relative z-9999 pointer-events-none"
        @click="router.push('/setting?index=6 ')"
        v-if="runtimeStore.isError"
      >
        <ToastComponent
          type="error"
          :duration="0"
          :shadow="false"
          :showClose="false"
          :message="$t('sync_failed_toast')"
        />
      </div>
      <!--      <slot></slot>-->
      <router-view></router-view>

      <div class="absolute right-4 top-4 flex z-1 gap-2" v-if="showIcon">
        <MiniProgram v-if="settingStore.load && !settingStore.first" />

        <div class="relative group">
          <BaseIcon>
            <IconPhTranslate />
          </BaseIcon>
          <div
            class="space-y-2 pt-2 absolute z-2 right-0 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto"
          >
            <div class="card mb-2 py-4 px-6 space-y-3">
              <div v-for="locale in locales" @click="setLocale(locale.code)" class="w-full cp break-keep black-link">
                {{ locale.name }}
              </div>
            </div>
          </div>
        </div>

        <BaseIcon
          :title="`${$t('toggle_theme')}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleTheme]})`"
          @click="toggleTheme"
        >
          <IconFluentWeatherMoon16Regular v-if="getTheme() === 'light'" />
          <IconFluentWeatherSunny16Regular v-else />
        </BaseIcon>
      </div>
    </div>
    <WordCollectPopover />
  </div>
</template>

<style scoped lang="scss">
.layout {
  width: 100%;
  height: 100%;
  display: flex;
  background: var(--color-primary);
}

.aside {
  background: var(--color-second);
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: rgb(0 0 0 / 3%) 0px 0px 12px 0px;
  width: var(--aside-width);
  transition: all 0.3s;
  z-index: 2;
  overflow: hidden;

  &.hidden-span {
    span {
      opacity: 0;
    }
  }
  .row {
    @apply cp rounded-md text p-2 my-2 flex items-center gap-2 relative shrink-0 hover:bg-fourth;
    transition: all 0.5s;
    color: var(--color-main-text);

    &.router-link-active {
      background: var(--color-fourth);
    }

    svg {
      @apply shrink-0 text-lg;
    }
    span {
      @apply shrink-0;
    }
  }
}

// 移动端顶部菜单栏
.mobile-top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: var(--color-second);
  border-bottom: 1px solid var(--color-item-border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.3s ease;

  .nav-items {
    display: flex;
    justify-content: space-around;
    padding: 0.5rem 0;

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
      min-width: 44px;
      justify-content: center;
      position: relative;

      svg {
        font-size: 1.2rem;
        margin-bottom: 0.2rem;
        color: var(--color-main-text);
      }

      span {
        font-size: 0.7rem;
        color: var(--color-main-text);
        text-align: center;
      }

      &.active {
        svg,
        span {
          color: var(--color-select-bg);
        }
      }

      &:active {
        transform: scale(0.95);
      }

      .red-point {
        position: absolute;
        top: 0.2rem;
        right: 0.2rem;
        width: 0.4rem;
        height: 0.4rem;
        background: #ff4444;
        border-radius: 50%;
      }
    }
  }

  .nav-toggle {
    position: absolute;
    bottom: -1.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-second);
    border: 1px solid var(--color-item-border);
    border-top: none;
    border-radius: 0 0 0.5rem 0.5rem;
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    transition: all 0.3s;

    svg {
      font-size: 1rem;
      color: var(--color-main-text);
    }

    &:active {
      transform: translateX(-50%) scale(0.95);
    }
  }

  &.collapsed {
    transform: translateY(calc(-100% + 1.5rem));

    .nav-items {
      opacity: 0;
      pointer-events: none;
    }
  }
}

.main-content {
  // 移动端时为主内容区域添加顶部内边距，避免被顶部菜单遮挡
  @media (max-width: 768px) {
    padding-top: 4rem;
  }
}

// 移动端隐藏左侧菜单栏
@media (max-width: 768px) {
  .aside {
    display: none;
  }

  .aside.space {
    display: none;
  }

  .main-content {
    width: 100%;
    margin-left: 0;
  }
}

// 桌面端隐藏移动端顶部菜单栏
@media (min-width: 769px) {
  .mobile-top-nav {
    display: none;
  }
}
</style>
