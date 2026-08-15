<script setup lang="ts">
import { BaseButton, Close } from '@/base'
import { watch } from 'vue'
import { APP_NAME, Host } from '@/core/config/env.ts'
import { isMobile } from '@/core/utils'

let showNotice = $ref(false)
let show = $ref(false)
let num = $ref(3)
let timer = -1
let mobile = $ref(isMobile())

const model = defineModel({ default: false })

function toggleNotice() {
  showNotice = true
  timer = setInterval(() => {
    num--
    if (num <= 0) close()
  }, 1000)
}

function close() {
  clearInterval(timer)
  show = false
  model.value = false
  localStorage.setItem('showConflictNotice', '1')
}

watch(
  model,
  n => {
    if (n && !localStorage.getItem('showConflictNotice')) {
      setTimeout(() => {
        show = true
      }, 300)
    }
  },
  { immediate: true }
)
</script>

<template>
  <transition name="right">
    <div class="CollectNotice card" :class="{ mobile }" v-if="show">
      <div class="notice">
        坚持练习，提高外语能力。将
        <span class="active font-bold">「{{ APP_NAME }}」</span>
        保存为书签，永不迷失！
      </div>
      <div class="collect">
        <div class="href-wrapper">
          <div class="round">
            <div class="text-base">{{ Host }}</div>
            <IconMdiStarOutline />
          </div>
          <div class="right">
            👈
            <IconMdiStar />
            点亮它!
          </div>
        </div>
      </div>
      <div class="text-base">
        Ctrl/Command + D 快速收藏
      </div>
      <BaseButton size="large" @click="toggleNotice" v-if="!showNotice">我已收藏</BaseButton>
      <div class="close-wrapper">
        <span v-show="showNotice"
          ><span class="active">{{ num }}s</span> 后自动关闭</span
        >
        <Close @click="close" title="关闭" />
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.right-enter-active,
.right-leave-active {
  transition: all 0.5s ease;
}

.right-enter-from,
.right-leave-to {
  transform: translateX(110%);
}

.CollectNotice {
  position: fixed;
  right: var(--space);
  top: var(--space);
  z-index: 2;
  font-size: 1.2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.8rem;
  width: 30rem;
  gap: 1rem;
  line-height: 1.5;

  &.mobile {
    width: 95%;
    padding: 0.6rem;
  }

  .notice {
    margin-top: 2.4rem;
  }

  .active {
    color: var(--color-select-bg);
  }

  .collect {
    display: flex;
    flex-direction: column;
    align-items: center;

    .href-wrapper {
      display: flex;
      font-size: 1rem;
      align-items: center;
      gap: 0.6rem;

      .round {
        border-radius: 3rem;
        padding: 0.6rem 0.6rem;
        padding-left: 1.2rem;
        gap: 2rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--color-primary);
      }

      .star {
        color: var(--color-select-bg);
      }

      .right {
        display: flex;
        align-items: center;
      }
    }

    .collect-keyboard {
      margin-top: 1.2rem;
      font-size: 1rem;

      span {
        margin-left: 0.6rem;
      }
    }
  }

  .close-wrapper {
    right: var(--space);
    top: var(--space);
    position: absolute;
    font-size: 0.9rem;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.6rem;
  }
}
</style>
