<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface IProps {
  modelValue: boolean
  disabled?: boolean
  width?: number // 开关宽度，默认 40px
  activeText?: string // 开启状态显示文字
  inactiveText?: string // 关闭状态显示文字
  type?: 'primary' | 'info'
}

const props = withDefaults(defineProps<IProps>(), {
  activeText: '开',
  inactiveText: '关',
  type: 'primary',
})

const emit = defineEmits(['update:modelValue', 'change'])

const isChecked = ref(props.modelValue)

watch(
  () => props.modelValue,
  val => {
    isChecked.value = val
  }
)

const toggle = () => {
  if (props.disabled) return
  isChecked.value = !isChecked.value
  emit('update:modelValue', isChecked.value)
  emit('change', isChecked.value)
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault()
    toggle()
  }
}

const switchWidth = computed(() => props.width ?? 40)
const switchHeight = computed(() => (switchWidth.value / 2) | 0)
const ballSize = computed(() => switchHeight.value - 4)
</script>

<template>
  <div
    class="switch"
    :class="{ checked: isChecked, disabled: disabled, [type]: true }"
    :tabindex="disabled ? -1 : 0"
    role="switch"
    :aria-checked="isChecked"
    @click="toggle"
    @keydown="onKeydown"
    :style="{ width: switchWidth + 'px', height: switchHeight + 'px', borderRadius: switchHeight + 'px' }"
  >
    <transition name="fade">
      <span class="text left" v-if="isChecked && activeText">{{ activeText }}</span>
    </transition>
    <div
      class="ball"
      :style="{
        width: ballSize + 'px',
        height: ballSize + 'px',
        transform: isChecked ? 'translateX(' + (switchWidth - ballSize - 2) + 'px)' : 'translateX(2px)',
      }"
    ></div>
    <transition name="fade">
      <span class="text right" v-if="!isChecked && inactiveText">{{ inactiveText }}</span>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.switch {
  @apply inline-flex items-center cursor-pointer user-select-none outline-none  position-relative transition-all duration-300;

  .ball {
    @apply bg-white rounded-full transition-transform duration-300 box-shadow-sm absolute;
  }

  .text {
    @apply absolute text-xs   user-select-none;
    font-size: 0.75rem;
    &.left {
      @apply ml-1.5;
    }
    &.right {
      @apply right-1.5;
    }
  }

  &.primary {
    @apply bg-gray-200;

    .ball {
      @apply bg-white;
    }
    .text {
      @apply text-black-500;
    }
    &.checked {
      @apply bg-blue-500;
      .text {
        @apply text-white;
      }
    }
  }

  &.info {
    @apply bg-white;

    .ball {
      @apply bg-gray-200;
    }
    .text {
      @apply text-gray-500;
    }
    &.checked {
      @apply bg-blue-500;
      .text {
        @apply text-gray-200;
      }
    }
  }

  &.disabled {
    @apply cursor-not-allowed opacity-60;
  }
}
</style>
