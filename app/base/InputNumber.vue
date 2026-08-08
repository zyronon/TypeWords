<template>
  <div class="input-number inline-center select-none anim" :class="{ 'is-disabled': disabled }">
    <!-- 减号 -->
    <button
        class="btn minus-btn inline-center cursor-pointer anim border-none outline-none w-8 h-8"
        type="button"
        :disabled="disabled || isMin"
        @mousedown.prevent="onHold(-1)"
        @mouseup="onRelease"
        @mouseleave="onRelease"
        aria-label="decrease"
    >-
    </button>

    <!-- 输入框 -->
    <input
        ref="inputRef"
        class="flex-1 h-8 px-2 text-center border-none outline-none bg-transparent input-inner w-14"
        :value="displayValue"
        :disabled="disabled"
        inputmode="decimal"
        @input="e => displayValue = e.target.value"
        @keydown.up.prevent="change(1)"
        @keydown.down.prevent="change(-1)"
        @blur="onBlur"
    />

    <!-- 加号 -->
    <button
        class="btn plus-btn inline-center cursor-pointer anim border-none outline-none w-8 h-8"
        type="button"
        :disabled="disabled || isMax"
        @mousedown.prevent="onHold(1)"
        @mouseup="onRelease"
        @mouseleave="onRelease"
        aria-label="increase"
    >+
    </button>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onBeforeUnmount, watch} from 'vue'

const props = defineProps({
  modelValue: {type: [Number, String], default: null},
  min: {type: Number, default: -Infinity},
  max: {type: Number, default: Infinity},
  step: {type: Number, default: 1},
  precision: {type: Number},
  disabled: {type: Boolean, default: false},
  stepStrictly: {type: Boolean, default: false},
})

const emit = defineEmits(['update:modelValue', 'input', 'change'])

const inputRef = ref<HTMLInputElement | null>(null)
const inner = ref<number | null>(normalizeToNumber(props.modelValue))
let holdTimer: number | null = null
let holdInterval: number | null = null

watch(() => props.modelValue, (value: number) => {
  inner.value = value
})
const displayValue = computed({
  get: () => inner.value === null ? '' : format(inner.value),
  set: v => {
    const n = parseInput(v)
    if (n === 'editing') return
    setValue(n)
  }
})

const isMin = computed(() => inner.value !== null && inner.value <= props.min)
const isMax = computed(() => inner.value !== null && inner.value >= props.max)

function normalizeToNumber(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clamp(n: number | null) {
  if (n === null) return null
  if (n < props.min) return props.min
  if (n > props.max) return props.max
  return n
}

function format(n: number) {
  return props.precision != null ? n.toFixed(props.precision) : String(n)
}

function parseInput(s: string): number | 'editing' | null {
  const trimmed = s.trim()
  if (['', '-', '+', '.', '-.', '+.'].includes(trimmed)) return 'editing'
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : 'editing'
}

function applyStepStrict(n: number | null) {
  if (n === null) return null
  if (!props.stepStrictly) return n
  const base = Number.isFinite(props.min) ? props.min : 0
  const k = Math.round((n - base) / props.step)
  return base + k * props.step
}

function toPrecision(n: number) {
  return props.precision != null ? Number(n.toFixed(props.precision)) : n
}

function setValue(n: number | null) {
  const v = clamp(toPrecision(applyStepStrict(n)))
  inner.value = v
  emit('update:modelValue', v)
  emit('input', v)
  emit('change', v)
}

function change(dir: 1 | -1) {
  if (props.disabled) return
  const base = inner.value ?? (Number.isFinite(props.min) ? props.min : 0)
  setValue(base + dir * props.step)
}

function onHold(dir: 1 | -1) {
  change(dir)
  holdTimer = window.setTimeout(() => {
    holdInterval = window.setInterval(() => change(dir), 100)
  }, 400)
}

function onRelease() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null
  }
  if (holdInterval) {
    clearInterval(holdInterval);
    holdInterval = null
  }
}

function onBlur() {
  const n = parseInput(displayValue.value)
  setValue(n === 'editing' ? inner.value : n)
}

onBeforeUnmount(onRelease)
</script>

<style scoped lang="scss">
.input-number {
  border: 1px solid var(--color-input-border);
  overflow: hidden;
  border-radius: 4px;
  background: var(--color-input-bg);

  &:hover {
    border-color: var(--color-select-bg);
  }

  &.is-disabled {
    opacity: .3;

    .btn, .input-inner {
      cursor: not-allowed;
    }
  }

  .input-inner {
    color: var(--color-input-color);
  }

  .btn {
    background: var(--color-second);
    color: var(--color-input-color);

    &.minus-btn {
      border-right: 1px solid var(--color-input-border);
    }

    &.plus-btn {
      border-left: 1px solid var(--color-input-border);
    }

    &:hover {
      background: var(--color-third);
      color: var(--color-select-bg);
    }

    &:disabled {
      opacity: .5;
      cursor: not-allowed;
    }
  }
}
</style>
