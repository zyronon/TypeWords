<script setup lang="ts">
import {ref, computed, watch} from 'vue';
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()

interface IProps {
  modelValue: boolean;
  disabled?: boolean;
  width?: number;       // 开关宽度，默认 40px
  activeText?: string;  // 开启状态显示文字
  inactiveText?: string;// 关闭状态显示文字
}

const props = withDefaults(defineProps<IProps>(), {
  activeText: '',
  inactiveText: '',
})

const emit = defineEmits(['update:modelValue', 'change']);

const isChecked = ref(props.modelValue);

watch(() => props.modelValue, (val) => {
  isChecked.value = val;
});

const toggle = () => {
  if (props.disabled) return;
  isChecked.value = !isChecked.value;
  emit('update:modelValue', isChecked.value);
  emit('change', isChecked.value);
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    toggle();
  }
};

const switchWidth = computed(() => props.width ?? 40);
const switchHeight = computed(() => (switchWidth.value / 2) | 0);
const ballSize = computed(() => switchHeight.value - 4);
const displayActiveText = computed(() => props.activeText || t('On'));
const displayInactiveText = computed(() => props.inactiveText || t('Off'));
</script>

<template>
  <div
      class="switch"
      :class="{ 'checked': isChecked, 'disabled': disabled }"
      :tabindex="disabled ? -1 : 0"
      role="switch"
      :aria-checked="isChecked"
      @click="toggle"
      @keydown="onKeydown"
      :style="{ width: switchWidth + 'px', height: switchHeight + 'px' ,borderRadius: switchHeight + 'px'}"
  >
    <transition name="fade">
      <span class="text left" v-if="isChecked && displayActiveText">{{ displayActiveText }}</span>
    </transition>
    <div
        class="ball"
        :style="{
          width: ballSize + 'px',
          height: ballSize + 'px',
          transform: isChecked ? 'translateX(' + (switchWidth - ballSize - 2) + 'px)' : 'translateX(2px)'
        }"
    ></div>
    <transition name="fade">
      <span class="text right" v-if="!isChecked && displayInactiveText">{{ displayInactiveText }}</span>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  outline: none;
  background-color: #DCDFE6;
  position: relative;
  transition: background-color 0.3s;

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &.checked {
    background-color: #409eff;
  }

  .ball {
    background-color: #fff;
    border-radius: 50%;
    transition: transform 0.3s;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
    position: absolute;
  }

  .text {
    position: absolute;
    font-size: 0.75rem;
    color: #fff;
    user-select: none;

    &.left {
      margin-left: 6px;
    }

    &.right {
      right: 6px;
    }
  }
}
</style>
