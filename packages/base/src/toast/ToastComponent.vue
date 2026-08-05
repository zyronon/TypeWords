<template>
  <Transition :name="anim ? 'message-fade' : ''" appear>
    <div
      v-if="visible"
      class="message"
      :class="{ [type]: true, shadow }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <div class="message-content">
        <IconFluentCheckmarkCircle20Filled v-if="props.type === 'success'" class="message-icon" />
        <IconFluentErrorCircle20Filled v-if="props.type === 'warning'" class="message-icon" />
        <IconFluentErrorCircle20Filled v-if="props.type === 'info'" class="message-icon" />
        <IconFluentDismissCircle20Filled v-if="props.type === 'error'" class="message-icon" />
        <span class="message-text">{{ message }}</span>

        <button v-if="action" class="message-action" @click="handleAction">{{ action.text }}</button>

        <Close v-if="showClose" class="message-close" @click="close" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Close } from '../icon'

interface ToastAction {
  text: string
  onClick?: () => void
}

interface Props {
  message: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
  showClose?: boolean
  shadow?: boolean
  anim?: boolean
  action?: ToastAction
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
  showClose: false,
  shadow: true,
  anim: true,
})

const emit = defineEmits(['close'])
const visible = ref(false)
let timer = null

const startTimer = () => {
  if (props.duration > 0) {
    timer = setTimeout(close, props.duration)
  }
}

const clearTimer = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

const handleMouseEnter = () => {
  clearTimer()
}

const handleMouseLeave = () => {
  startTimer()
}

const handleAction = () => {
  props.action?.onClick?.()
}

const close = () => {
  visible.value = false
  // 延迟发出close事件，等待动画完成
  setTimeout(() => {
    emit('close')
  }, 300) // 等待动画完成（0.3秒）
}

onMounted(() => {
  visible.value = true
  startTimer()
})

onBeforeUnmount(() => {
  clearTimer()
})

// 暴露方法给父组件
defineExpose({
  close,
  show: () => {
    visible.value = true
    startTimer()
  },
})
</script>

<style scoped lang="scss">
.message {
  border: 1px solid #ebeef5;
  transition: all 0.3s ease;
  pointer-events: auto;
  @apply rounded-md py-3 px-5 relative min-w-50 text-base;

  &.shadow {
    @apply shadow-xl;
  }

  &.success {
    background: #f0f9ff;
    border-color: #67c23a;
    color: #67c23a;
  }

  &.warning {
    background: #fdf6ec;
    border-color: #e6a23c;
    color: #e6a23c;
  }

  &.info {
    background: #f4f4f5;
    border-color: #c1c1c1;
    color: #909399;
  }

  &.error {
    background: #fef0f0;
    border-color: #f56c6c;
    color: #f56c6c;
  }
}

// 深色模式支持
html.dark {
  .message {
    background: var(--color-second);
    border-color: var(--color-item-border);
    color: var(--color-main-text);

    &.success {
      background: rgb(42, 50, 40);
      border-color: #67c23a;
      color: #67c23a;
    }

    &.warning {
      background: rgb(51, 47, 40);
      border-color: #e6a23c;
      color: #e6a23c;
    }

    &.info {
      background: rgb(44, 45, 48);
      border-color: #909399;
      color: #909399;
    }

    &.error {
      background: #342a2b;
      border-color: #f56c6c;
      color: #f56c6c;
    }
  }
}

.message-content {
  @apply flex items-center gap-2;
}

.message-text {
  @apply flex-1 lh-none;
}

.message-action {
  @apply ml-2 shrink-0 cp text-sm font-medium px-2 py-0.5 rounded color-blue;
  border: 1px solid currentColor;
  background: transparent;
  line-height: 1.4;
  transition: opacity 0.2s;
}

.message-close {
  @apply w-10 flex justify-end cp opacity-70 hover:opacity-100;
}

.message-fade-enter-active,
.message-fade-leave-active {
  transition: all 0.3s ease;
}

.message-fade-enter-from {
  opacity: 0;
  transform: translateY(-40px);
}

.message-fade-leave-to {
  opacity: 0;
  transform: translateY(-40px);
}
</style>
