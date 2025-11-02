<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useAttrs, useSlots, VNode, watch} from 'vue';
import {useWindowClick} from "@/hooks/event.ts";
import { useLanguage } from '@/hooks/useLanguage'

const { t } = useLanguage()

interface Option {
  label: string;
  value: any;
  disabled?: boolean;
}

const props = defineProps<{
  modelValue: any;
  placeholder?: string;
  disabled?: boolean;
  options?: Option[];
}>();

const emit = defineEmits(['update:modelValue']);
const attrs = useAttrs();

const isOpen = ref(false);
const isReverse = ref(false);
const dropdownStyle = ref({}); // Teleport 用的样式
const selectedOption = ref<Option | null>(null);
const selectRef = ref<HTMLDivElement | null>(null);
const dropdownRef = ref<HTMLDivElement | null>(null);
const slots = useSlots();

const displayValue = computed(() => {
  return selectedOption.value
      ? selectedOption.value.label
      : props.placeholder || t('PleaseSelect');
});

const hasSelectedSlot = computed(() => {
  return !!slots.selected;
});

const updateDropdownPosition = async () => {
  if (!selectRef.value || !dropdownRef.value) return;

  // 等待 DOM 完全渲染（尤其是下拉框高度）
  await nextTick();
  await new Promise(requestAnimationFrame);

  const rect = selectRef.value.getBoundingClientRect();
  const dropdownHeight = dropdownRef.value.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  isReverse.value = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

  dropdownStyle.value = {
    position: 'fixed',
    left: rect.left + 'px',
    width: rect.width + 'px',
    top: !isReverse.value
        ? rect.bottom + 5 + 'px'
        : 'auto',
    bottom: isReverse.value
        ? window.innerHeight - rect.top + 5 + 'px'
        : 'auto',
    zIndex: 9999
  };
};

const toggleDropdown = async () => {
  if (props.disabled) return;

  isOpen.value = !isOpen.value;

  if (isOpen.value) {
    await nextTick();
    await new Promise(requestAnimationFrame);
    await updateDropdownPosition();
  }
};

const selectOption = (value: any, label: string) => {
  selectedOption.value = {value, label};
  emit('update:modelValue', value);
  isOpen.value = false;
};

let selectValue = $ref(props.modelValue);

provide('selectValue', selectValue);
provide('selectHandler', selectOption);

useWindowClick((e: PointerEvent) => {
  if (!e) return;
  if (
      selectRef.value &&
      !selectRef.value.contains(e.target as Node) &&
      dropdownRef.value &&
      !dropdownRef.value.contains(e.target as Node)
  ) {
    isOpen.value = false;
  }
});

watch(() => props.modelValue, (newValue) => {
  selectValue = newValue;
  if (slots.default) {
    let slot = slots.default();
    let list = [];
    if (slot.length === 1) {
      list = Array.from(slot[0].children as Array<VNode>);
    } else {
      list = slot;
    }
    const option = list.find(opt => opt.props.value === newValue);
    if (option) {
      selectedOption.value = option.props;
    }
    return;
  }
  if (props.options) {
    const option = props.options.find(opt => opt.value === newValue);
    if (option) {
      selectedOption.value = option;
    }
  }
}, {immediate: true});

watch(() => props.options, (newOptions) => {
  if (newOptions && props.modelValue) {
    const option = newOptions.find(opt => opt.value === props.modelValue);
    if (option) {
      selectedOption.value = option;
    }
  }
}, {immediate: true});

const handleOptionClick = (option: Option) => {
  if (option.disabled) return;
  selectOption(option.value, option.label);
};

const onScrollOrResize = () => {
  if (isOpen.value) updateDropdownPosition();
};

onMounted(() => {
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize);
});
</script>

<template>
  <div
      class="select"
      v-bind="attrs"
      :class="{ 'is-disabled': disabled, 'is-active': isOpen, 'is-reverse': isReverse }"
      ref="selectRef"
  >
    <div class="select__wrapper" @click="toggleDropdown">
      <div class="select__label" :class="{ 'is-placeholder': !selectedOption }">
        <slot name="selected" v-if="hasSelectedSlot"></slot>
        <template v-else>{{ displayValue }}</template>
      </div>
      <div class="select__suffix">
        <IconFluentChevronLeft20Filled
            class="arrow"
            :class="{ 'is-reverse': isOpen }"
            width="16"
        />
      </div>
    </div>

    <teleport to="body">
      <transition :name="isReverse ? 'zoom-in-bottom' : 'zoom-in-top'" :key="isReverse ? 'bottom' : 'top'">
        <div
            class="select__dropdown"
            v-if="isOpen"
            ref="dropdownRef"
            :style="dropdownStyle"
        >
          <ul class="select__options">
            <li
                v-if="options"
                v-for="(option, index) in options"
                :key="index"
                class="select__option"
                :class="{
            'is-selected': option.value === modelValue,
            'is-disabled': option.disabled
          }"
                @click="handleOptionClick(option)"
            >
              {{ option.label }}
            </li>
            <slot v-else></slot>
          </ul>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped lang="scss">
.select {
  position: relative;
  width: 100%;
  font-size: 1rem;

  &__wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 2rem;
    padding: 0 0.5rem;
    border: 1px solid var(--color-input-border);
    border-radius: 0.25rem;
    background-color: var(--color-input-bg, #fff);
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      border-color: var(--color-select-bg);
    }
  }

  &__label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.is-placeholder {
      color: #999;
    }
  }

  &__suffix {
    display: flex;
    align-items: center;
    color: #999;

    .arrow {
      transform: rotate(-90deg);
      transition: transform 0.3s;
    }

    .is-reverse {
      transform: rotate(90deg);
    }
  }
}

.select__dropdown {
  max-height: 200px;
  overflow-y: auto;
  background-color: #fff;
  border: 1px solid var(--color-input-border);
  border-radius: 0.25rem;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.select__options {
  margin: 0;
  padding: 0;
  list-style: none;
}

.select__option {
  padding: 0.5rem;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #f5f7fa;
  }

  &.is-selected {
    color: var(--color-select-bg);
    font-weight: bold;
    background-color: #f5f7fa;
  }
}

.is-disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 往下展开的动画 */
.zoom-in-top-enter-active,
.zoom-in-top-leave-active {
  transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1),
  opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  transform-origin: center top;
}

.zoom-in-top-enter-from,
.zoom-in-top-leave-to {
  opacity: 0;
  transform: scaleY(0);
}

/* 往上展开的动画 */
.zoom-in-bottom-enter-active,
.zoom-in-bottom-leave-active {
  transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1),
  opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  transform-origin: center bottom;
}

.zoom-in-bottom-enter-from,
.zoom-in-bottom-leave-to {
  opacity: 0;
  transform: scaleY(0);
}
</style>
