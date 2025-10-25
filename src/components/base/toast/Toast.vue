<template>
  <Transition name="message-fade" appear>
    <div v-if="visible" class="message" :class="type" :style="style" @mouseenter="handleMouseEnter"
         @mouseleave="handleMouseLeave">
      <div class="message-content">
        <IconFluentCheckmarkCircle20Filled v-if="props.type === 'success'" class="message-icon"/>
        <IconFluentErrorCircle20Filled v-if="props.type === 'warning'" class="message-icon"/>
        <IconFluentErrorCircle20Filled v-if="props.type === 'info'" class="message-icon"/>
        <IconFluentDismissCircle20Filled v-if="props.type === 'error'" class="message-icon"/>
        <span class="message-text">{{ t(message) }}</span>
        <Close v-if="showClose" class="message-close" @click="close"/>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue'
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()

interface Props {
  message: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
  showClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
  showClose: false
})

const emit = defineEmits(['close'])
const visible = ref(false)
let timer = null

const style = computed(() => ({
  // 移除offset，现在由容器管理位置
}))

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
  }
})
</script>

<style scoped lang="scss">
.message {
  position: relative;
  min-width: 16rem;
  padding: 0.8rem 1rem;
  border-radius: 0.2rem;
  box-shadow: 0 0.2rem 0.9rem rgba(0, 0, 0, 0.15);
  background: white;
  border: 1px solid #ebeef5;
  transition: all 0.3s ease;
  pointer-events: auto;

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
    border-color: #909399;
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
      background: rgba(103, 194, 58, 0.1);
      border-color: #67c23a;
      color: #67c23a;
    }

    &.warning {
      background: rgba(230, 162, 60, 0.1);
      border-color: #e6a23c;
      color: #e6a23c;
    }

    &.info {
      background: rgba(144, 147, 153, 0.1);
      border-color: #909399;
      color: #909399;
    }

    &.error {
      background: rgba(245, 108, 108, 0.1);
      border-color: #f56c6c;
      color: #f56c6c;
    }
  }
}

.message-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-icon {
  font-size: 1.2rem;
}

.message-text {
  flex: 1;
  font-size: 14px;
}

.message-close {
  cursor: pointer;
  font-size: 1.2rem;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
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
