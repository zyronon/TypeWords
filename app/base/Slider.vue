<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import InputNumber from './InputNumber.vue'

type SliderValue = number | [number, number] | string
type DragTarget = 'single' | 'start' | 'end' | 'track' | null

const props = withDefaults(
  defineProps<{
    modelValue: SliderValue
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    showText?: boolean
    showValue?: boolean
    showInput?: boolean
    range?: boolean
    minGap?: number
    draggableTrack?: boolean
    unit?: string
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    showText: false,
    showValue: false,
    showInput: false,
    range: false,
    minGap: 0,
    draggableTrack: false,
    unit: '',
  }
)

const emit = defineEmits<{
  'update:modelValue': [SliderValue]
}>()

const sliderRef = ref<HTMLElement | null>(null)
const sliderLeft = ref(0)
const sliderWidth = ref(0)
const dragTarget = ref<DragTarget>(null)
const dragStartPageX = ref(0)
const dragStartRange = ref<[number, number]>([props.min, props.max])

const safeMin = computed(() => Number(props.min) || 0)
const safeMax = computed(() => Math.max(safeMin.value, Number(props.max) || 0))
const safeStep = computed(() => {
  const step = Number(props.step) || 1
  return step > 0 ? step : 1
})
const effectiveMinGap = computed(() => Math.min(Math.max(Number(props.minGap) || 0, 0), safeMax.value - safeMin.value))
const currentValue = ref<SliderValue>(normalizeValue(props.modelValue))
const singleValue = computed(() => normalizeSingle(currentValue.value))
const rangeValue = computed(() => normalizeRange(currentValue.value))
const fillStyle = computed(() => {
  if (props.range) {
    const [start, end] = rangeValue.value
    const left = valueToPercent(start)
    return {
      left: `${left}%`,
      width: `${valueToPercent(end) - left}%`,
    }
  }
  return {
    left: '0%',
    width: `${valueToPercent(singleValue.value)}%`,
  }
})
const displayValue = computed(() => {
  if (props.range) return `${rangeValue.value[0]} - ${rangeValue.value[1]}${props.unit}`
  return `${singleValue.value}${props.unit}`
})

watch(
  () => [props.modelValue, props.min, props.max, props.step, props.range, props.minGap] as const,
  () => {
    const normalized = normalizeValue(props.modelValue)
    currentValue.value = normalized
    if (!isSameValue(normalized, props.modelValue)) {
      emit('update:modelValue', normalized)
    }
  },
  { deep: true }
)

function countDecimals(value: number) {
  if (Math.floor(value) === value) return 0
  const str = value.toString()
  if (str.includes('e-')) {
    const [, trail] = str.split('e-')
    return parseInt(trail, 10)
  }
  return str.split('.')[1]?.length || 0
}

function alignToStep(value: number) {
  const decimals = countDecimals(safeStep.value)
  const aligned = safeMin.value + Math.round((value - safeMin.value) / safeStep.value) * safeStep.value
  return Number(aligned.toFixed(decimals))
}

function clamp(value: number) {
  return Math.min(Math.max(value, safeMin.value), safeMax.value)
}

function normalizeSingle(value: SliderValue): number {
  const raw = Array.isArray(value) ? value[0] : value
  return clamp(alignToStep(Number(raw) || safeMin.value))
}

function normalizeRange(value: SliderValue, target?: DragTarget): [number, number] {
  const raw = Array.isArray(value) ? value : [safeMin.value, Number(value) || safeMin.value]
  let start = clamp(alignToStep(Number(raw[0]) || safeMin.value))
  let end = clamp(alignToStep(Number(raw[1]) || safeMin.value))

  if (start > end) {
    ;[start, end] = [end, start]
  }

  const gap = effectiveMinGap.value
  if (end - start < gap) {
    if (target === 'start') {
      start = end - gap
    } else if (target === 'end') {
      end = start + gap
    } else {
      const center = (start + end) / 2
      start = center - gap / 2
      end = center + gap / 2
    }
  }

  if (start < safeMin.value) {
    start = safeMin.value
    end = start + gap
  }
  if (end > safeMax.value) {
    end = safeMax.value
    start = end - gap
  }

  return [clamp(alignToStep(start)), clamp(alignToStep(end))]
}

function normalizeValue(value: SliderValue): SliderValue {
  return props.range ? normalizeRange(value) : normalizeSingle(value)
}

function isSameValue(a: SliderValue, b: SliderValue) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1]
  }
  return a === b
}

function commitValue(value: SliderValue, target?: DragTarget) {
  const normalized = props.range ? normalizeRange(value, target) : normalizeSingle(value)
  currentValue.value = normalized
  emit('update:modelValue', normalized)
}

function valueToPercent(value: number) {
  const span = safeMax.value - safeMin.value
  if (!span) return 0
  return ((clamp(value) - safeMin.value) / span) * 100
}

function percentToValue(percent: number) {
  const bounded = Math.min(Math.max(percent, 0), 100)
  return clamp(alignToStep(safeMin.value + ((safeMax.value - safeMin.value) * bounded) / 100))
}

function updateSliderRect() {
  if (!sliderRef.value) return
  const rect = sliderRef.value.getBoundingClientRect()
  sliderLeft.value = rect.left
  sliderWidth.value = rect.width
}

function valueFromPageX(pageX: number) {
  if (!sliderWidth.value) updateSliderRect()
  const percent = ((pageX - sliderLeft.value) / sliderWidth.value) * 100
  return percentToValue(percent)
}

function setValueFromPageX(pageX: number, target: Exclude<DragTarget, 'track' | null>) {
  const value = valueFromPageX(pageX)
  if (!props.range) {
    commitValue(value, 'single')
    return
  }

  const [start, end] = rangeValue.value
  commitValue(target === 'start' ? [value, end] : [start, value], target)
}

function nearestRangeTarget(value: number): 'start' | 'end' {
  const [start, end] = rangeValue.value
  return Math.abs(value - start) <= Math.abs(value - end) ? 'start' : 'end'
}

function bindDragListeners() {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function unbindDragListeners() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

function onTrackPointerDown(e: PointerEvent) {
  if (props.disabled) return
  e.preventDefault()
  updateSliderRect()
  if (!props.range) {
    dragTarget.value = 'single'
    setValueFromPageX(e.pageX, 'single')
  } else {
    const value = valueFromPageX(e.pageX)
    const target = nearestRangeTarget(value)
    dragTarget.value = target
    setValueFromPageX(e.pageX, target)
  }
  bindDragListeners()
}

function onThumbPointerDown(target: Exclude<DragTarget, 'track' | null>, e: PointerEvent) {
  if (props.disabled) return
  e.preventDefault()
  e.stopPropagation()
  updateSliderRect()
  dragTarget.value = target
  setValueFromPageX(e.pageX, target)
  bindDragListeners()
}

function onFillPointerDown(e: PointerEvent) {
  if (props.disabled) return
  if (!props.range || !props.draggableTrack) {
    onTrackPointerDown(e)
    return
  }
  e.preventDefault()
  e.stopPropagation()
  updateSliderRect()
  dragTarget.value = 'track'
  dragStartPageX.value = e.pageX
  dragStartRange.value = rangeValue.value
  bindDragListeners()
}

function onPointerMove(e: PointerEvent) {
  if (!dragTarget.value) return
  e.preventDefault()

  if (dragTarget.value === 'track') {
    const [start, end] = dragStartRange.value
    const size = end - start
    const delta = ((e.pageX - dragStartPageX.value) / sliderWidth.value) * (safeMax.value - safeMin.value)
    let nextStart = alignToStep(start + delta)
    if (nextStart < safeMin.value) nextStart = safeMin.value
    if (nextStart + size > safeMax.value) nextStart = safeMax.value - size
    commitValue([nextStart, nextStart + size], 'track')
    return
  }

  setValueFromPageX(e.pageX, dragTarget.value)
}

function onPointerUp() {
  dragTarget.value = null
  unbindDragListeners()
}

function onInputNumber(value: number | string | null) {
  commitValue(Number(value) || safeMin.value, 'single')
}

onMounted(() => {
  nextTick(() => {
    updateSliderRect()
    window.addEventListener('resize', updateSliderRect)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateSliderRect)
  unbindDragListeners()
})
</script>

<template>
  <div class="w-full flex items-start gap-3">
    <div class="flex-1">
      <div
        ref="sliderRef"
        class="custom-slider"
        :class="{ 'is-disabled': disabled }"
        @pointerdown="onTrackPointerDown"
      >
        <div class="custom-slider__track"></div>
        <div
          class="custom-slider__fill"
          :class="{ 'is-draggable': range && draggableTrack }"
          :style="fillStyle"
          @pointerdown.stop="onFillPointerDown"
        ></div>
        <div
          class="custom-slider__thumb"
          :style="{ left: valueToPercent(range ? rangeValue[0] : singleValue) + '%' }"
          tabindex="0"
          role="slider"
          :aria-valuemin="safeMin"
          :aria-valuemax="safeMax"
          :aria-valuenow="range ? rangeValue[0] : singleValue"
          :aria-disabled="disabled"
          @pointerdown="onThumbPointerDown(range ? 'start' : 'single', $event)"
        ></div>
        <div
          v-if="range"
          class="custom-slider__thumb"
          :style="{ left: valueToPercent(rangeValue[1]) + '%' }"
          tabindex="0"
          role="slider"
          :aria-valuemin="safeMin"
          :aria-valuemax="safeMax"
          :aria-valuenow="rangeValue[1]"
          :aria-disabled="disabled"
          @pointerdown="onThumbPointerDown('end', $event)"
        ></div>
      </div>
      <div class="text flex justify-between text-sm color-gray" v-if="showText">
        <span>{{ safeMin }}</span>
        <span>{{ safeMax }}</span>
      </div>
    </div>
    <InputNumber
      v-if="showInput && !range"
      class="slider-input"
      :min="safeMin"
      :max="safeMax"
      :step="safeStep"
      :model-value="singleValue"
      @update:model-value="onInputNumber"
    />
    <div v-else-if="showValue" class="slider-value">{{ displayValue }}</div>
  </div>
</template>

<style scoped lang="scss">
.custom-slider {
  position: relative;
  width: 100%;
  height: 24px;
  user-select: none;
  touch-action: none;
  cursor: pointer;

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &__track {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 6px;
    background-color: #ddd;
    border-radius: 2px;
    transform: translateY(-50%);
  }

  &__fill {
    position: absolute;
    top: 50%;
    height: 6px;
    background-color: #409eff;
    border-radius: 2px;
    transform: translateY(-50%);
    pointer-events: auto;

    &.is-draggable {
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    }
  }

  &__thumb {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    background-color: #fff;
    border: 2px solid #409eff;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    cursor: grab;
    transition: box-shadow 0.2s;
    z-index: 1;

    &:focus {
      outline: none;
      box-shadow: 0 0 5px #409eff;
      cursor: grabbing;
    }
  }
}

.slider-value {
  width: 4rem;
  padding-left: 0.5rem;
  line-height: 24px;
  white-space: nowrap;
}

.slider-input {
  width: 8rem;
}
</style>
