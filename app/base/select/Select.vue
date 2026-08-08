<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useSlots, watch } from 'vue'
import type { VNode } from 'vue'

interface Option {
  label: string
  value: any
  disabled?: boolean
}

const props = defineProps<{
  modelValue: any
  placeholder?: string
  disabled?: boolean
  options?: Option[]
}>()

const emit = defineEmits(['update:modelValue', 'toggle'])

const isOpen = ref(false)
const isReverse = ref(false)
const dropdownStyle = ref({}) // Teleport 用的样式
const selectedOption = ref<Option | null>(null)
const selectRef = ref<HTMLDivElement | null>(null)
const dropdownRef = ref<HTMLDivElement | null>(null)
const slots = useSlots()

const displayValue = computed(() => {
  return selectedOption.value ? selectedOption.value.label : props.placeholder || '请选择'
})

const updateDropdownPosition = async () => {
  if (!selectRef.value || !dropdownRef.value) return

  // 等待 DOM 完全渲染（尤其是下拉框高度）
  await nextTick()
  await new Promise(requestAnimationFrame)

  const rect = selectRef.value.getBoundingClientRect()
  const dropdownHeight = dropdownRef.value.offsetHeight
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  isReverse.value = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

  dropdownStyle.value = {
    position: 'fixed',
    left: rect.left + 'px',
    width: rect.width + 'px',
    top: !isReverse.value ? rect.bottom + 5 + 'px' : 'auto',
    bottom: isReverse.value ? window.innerHeight - rect.top + 5 + 'px' : 'auto',
    zIndex: 9999,
  }
}

const toggleDropdown = async () => {
  if (props.disabled) return

  isOpen.value = !isOpen.value
  emit('toggle', isOpen.value)

  if (isOpen.value) {
    await nextTick()
    await new Promise(requestAnimationFrame)
    await updateDropdownPosition()
  }
}

const selectOption = (value: any, label: string) => {
  selectedOption.value = { value, label }
  emit('update:modelValue', value)
  isOpen.value = false
  emit('toggle', isOpen.value)
}

let selectValue = ref(props.modelValue)

provide('selectValue', selectValue)
provide('selectHandler', selectOption)

function onClick(e: PointerEvent) {
  if (!e) return
  if (
    selectRef.value &&
    !selectRef.value.contains(e.target as Node) &&
    dropdownRef.value &&
    !dropdownRef.value.contains(e.target as Node)
  ) {
    isOpen.value = false
    emit('toggle', isOpen.value)
  }
}

watch(
  () => props.modelValue,
  newValue => {
    if (newValue) window.addEventListener('click', onClick)
    else window.removeEventListener('click', onClick)

    selectValue.value = newValue
    if (slots.default) {
      let slot = slots.default()
      let list = []
      if (slot.length === 1) {
        list = Array.from(slot[0].children as Array<VNode>)
      } else {
        list = slot
      }
      const option = list.find(opt => opt.props.value === newValue)
      if (option) {
        selectedOption.value = option.props
      }
      return
    }
    if (props.options) {
      const option = props.options.find(opt => opt.value === newValue)
      if (option) {
        selectedOption.value = option
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.options,
  newOptions => {
    if (newOptions && props.modelValue) {
      const option = newOptions.find(opt => opt.value === props.modelValue)
      if (option) {
        selectedOption.value = option
      }
    }
  },
  { immediate: true }
)

const onScrollOrResize = () => {
  if (isOpen.value) updateDropdownPosition()
}

onMounted(() => {
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})
</script>

<template>
  <div class="select" ref="selectRef">
    <div class="select__wrapper" :class="{ disabled: disabled, active: isOpen }" @click="toggleDropdown">
      <div class="select__label" :class="{ 'is-placeholder': !selectedOption }">
        {{ displayValue }}
      </div>
      <IconFluentChevronLeft20Filled class="select__arrow" :class="{ 'is-reverse': isOpen }" width="16" />
    </div>

    <teleport to="body">
      <transition :name="isReverse ? 'zoom-in-bottom' : 'zoom-in-top'" :key="isReverse ? 'bottom' : 'top'">
        <div class="select__dropdown" v-if="isOpen" ref="dropdownRef" :style="dropdownStyle">
          <slot></slot>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped lang="scss">
.select {
  @apply relative w-full;

  &__wrapper {
    @apply flex items-center justify-between rounded-md cursor-pointer transition-all duration-300;
    height: 2rem;
    padding: 0 0.5rem;
    border: 1px solid var(--color-input-border);

    &:not(.disabled):hover {
      border-color: #3c89e8;
    }

    &.active {
      border-color: #1668dc !important;
      box-shadow: 0 0 2px 1px #166ce4;
    }

    &.disabled {
      background: var(--color-fourth);
      opacity: 0.5;
      cursor: not-allowed;
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

  &__arrow {
    color: #999;
    transform: rotate(-90deg);
    transition: transform 0.3s;

    &.is-reverse {
      transform: rotate(90deg);
    }
  }
}

.select__dropdown {
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--color-card-bg);
  @apply shadow-xl rounded-lg border border-gray-300 border-solid;
}

/* 往下展开的动画 */
.zoom-in-top-enter-active,
.zoom-in-top-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.23, 1, 0.32, 1),
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
  transition:
    transform 0.3s cubic-bezier(0.23, 1, 0.32, 1),
    opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  transform-origin: center bottom;
}

.zoom-in-bottom-enter-from,
.zoom-in-bottom-leave-to {
  opacity: 0;
  transform: scaleY(0);
}
</style>
