<script setup lang="ts">
import { ref, useAttrs, watch, computed, onUnmounted } from 'vue'
import Close from './icon/Close.vue'
import { useDisableEventListener } from '@/core/hooks/event'

const props = defineProps({
  modelValue: [String, Number],
  placeholder: String,
  disabled: Boolean,
  autofocus: Boolean,
  error: Boolean,
  type: {
    type: String,
    default: 'text',
  },
  clearable: {
    type: Boolean,
    default: false,
  },
  searchable: {
    type: Boolean,
    default: false,
  },
  searchLoading: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
  maxLength: Number,
  size: {
    type: String,
    default: 'normal',
    validator: (value: string) => ['normal', 'large'].includes(value),
  },
})

const emit = defineEmits(['update:modelValue', 'input', 'change', 'focus', 'blur', 'validation', 'enter', 'search'])
const attrs = useAttrs()

const inputValue = ref(props.modelValue)
let focus = $ref(false)
let inputEl = $ref<HTMLDivElement>()
const passwordVisible = ref(false)

useDisableEventListener(() => focus)

const inputType = computed(() => {
  if (props.type === 'password') {
    return passwordVisible.value ? 'text' : 'password'
  }
  return props.type
})

const togglePasswordVisibility = () => {
  passwordVisible.value = !passwordVisible.value
}

watch(
  () => props.modelValue,
  val => {
    inputValue.value = val
  }
)

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  inputValue.value = target.value
  emit('update:modelValue', target.value)
  emit('input', e)
  emit('change', e)
}

const onChange = (e: Event) => {
  emit('change', e)
}

const onFocus = (e: FocusEvent) => {
  focus = true
  emit('focus', e)
}

const onBlur = (e: FocusEvent) => {
  focus = false
  emit('blur', e)
}

const onEnter = (e: KeyboardEvent) => {
  emit('enter', e)
}

const clearInput = () => {
  inputValue.value = ''
  emit('update:modelValue', '')
}

const onSearch = () => {
  if (props.disabled || props.searchLoading) return
  emit('search')
}

const vFocus = {
  mounted: (el, bind) => {
    if (bind.value) {
      el.focus()
      setTimeout(() => (focus = true))
    }
  },
}
</script>

<template>
  <div
    class="base-input"
    ref="inputEl"
    :class="{ 'is-disabled': disabled, error: props.error, focus, [`base-input--${size}`]: true }"
  >
    <slot name="subfix"></slot>
    <!-- PreIcon slot -->
    <div v-if="$slots.preIcon" class="pre-icon">
      <slot name="preIcon"></slot>
    </div>
    <IconFluentLockClosed20Regular class="pre-icon" v-if="type === 'password'" />
    <IconFluentMail20Regular class="pre-icon" v-if="type === 'email'" />
    <IconFluentPhone20Regular class="pre-icon" v-if="type === 'tel'" />
    <IconFluentNumberSymbol20Regular class="pre-icon" v-if="type === 'code'" />

    <input
      v-bind="attrs"
      :type="inputType"
      :placeholder="placeholder"
      :disabled="disabled"
      :value="inputValue"
      @input="onInput"
      @change="onChange"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.enter="onEnter"
      class="inner"
      v-focus="autofocus"
      :maxlength="maxLength"
    />
    <slot name="prefix"></slot>
    <Close v-if="clearable && inputValue && !disabled" @click="clearInput" />
    <IconFluentSearch20Regular
      v-if="searchable && !disabled"
      class="search-toggle"
      :class="{ 'is-loading': searchLoading }"
      title="搜索"
      @click="onSearch"
    />
    <!-- Password visibility toggle -->
    <div
      v-if="type === 'password' && !disabled"
      class="password-toggle"
      @click="togglePasswordVisibility"
      :title="passwordVisible ? '隐藏密码' : '显示密码'"
    >
      <IconFluentEye16Regular v-if="!passwordVisible" />
      <IconFluentEyeOff16Regular v-else />
    </div>
  </div>
</template>

<style scoped lang="scss">
.base-input {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  width: 100%;
  border: 1px solid var(--color-input-border);
  border-radius: 6px;
  overflow: hidden;
  padding: 0.2rem 0.3rem;
  transition: all 0.3s;
  align-items: center;
  background: var(--color-input-bg);

  ::placeholder {
    font-size: 0.9rem;
    color: darkgray;
  }

  // normal size (default)
  &--normal {
    padding: 0.2rem 0.3rem;

    .inner {
      height: 1.5rem;
      font-size: 1rem;
    }
  }

  // large size
  &--large {
    padding: 0.4rem 0.6rem;
    border-radius: 0.5rem;

    .inner {
      height: 2rem;
      font-size: 1.125rem;
    }
  }

  &.is-disabled {
    opacity: 0.6;
  }

  &.error {
    border-color: #f56c6c;
    background: rgba(245, 108, 108, 0.07);
  }

  &.focus {
    border: 1px solid var(--color-select-bg);
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  // PreIcon styling
  &.has-preicon {
    .inner {
      padding-left: 2rem;
    }
  }

  .pre-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-input-color);
    opacity: 0.6;
    z-index: 1;
    pointer-events: none;
    margin-right: 0.2rem;
  }

  .inner {
    flex: 1;
    font-size: 1rem;
    outline: none;
    border: none;
    box-sizing: border-box;
    transition: all 0.3s;
    height: 1.5rem;
    color: var(--color-input-color);
    background: transparent;
    width: 100%;
  }

  .password-toggle,
  .search-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-left: 4px;
    cursor: pointer;
    color: var(--color-input-color);
    opacity: 0.6;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }

    &.is-loading {
      opacity: 0.4;
      pointer-events: none;
    }
  }
}
</style>
